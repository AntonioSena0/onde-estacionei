import type { IncomingMessage, ServerResponse } from 'node:http';
import type { RemoteState } from '../src/lib/reconcile.ts';
import { parseSpot } from '../src/lib/validation.ts';
import type { Db, Device } from './db.ts';

type AppOptions = {
  db: Db;
  allowedOrigins?: string[];
  rateLimitPerMinute?: number;
  maxStreamsPerUser?: number;
  heartbeatMs?: number;
  hsts?: boolean;
};

const MAX_BODY_BYTES = 2048;

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Cache-Control': 'no-store',
};

class HttpError extends Error {
  status: number;
  headers: Record<string, string>;

  /** Cria um erro HTTP com status, mensagem pública e cabeçalhos extras. */
  constructor(status: number, message: string, headers: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}

/**
 * Cria o tratador de requisições da API: autenticação por token, limite de taxa,
 * validação, controle de versão e transmissão em tempo real (SSE) por usuário.
 */
export function createApp(opts: AppOptions) {
  const {
    db,
    allowedOrigins = [],
    rateLimitPerMinute = 120,
    maxStreamsPerUser = 5,
    heartbeatMs = 20_000,
    hsts = false,
  } = opts;
  const streams = new Map<number, Set<ServerResponse>>();
  const hits = new Map<string, { count: number; resetAt: number }>();
  const baseHeaders: Record<string, string> = hsts
    ? { ...SECURITY_HEADERS, 'Strict-Transport-Security': 'max-age=31536000' }
    : SECURITY_HEADERS;

  /** Envia uma resposta JSON com os cabeçalhos de segurança. */
  function sendJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
    res.writeHead(status, { ...baseHeaders, 'Content-Type': 'application/json; charset=utf-8', ...headers });
    res.end(JSON.stringify(body));
  }

  /**
   * Conta uma requisição para a chave (IP ou aparelho) e barra quem passar do limite por minuto.
   * Janelas vencidas são descartadas quando o mapa cresce, para o próprio limite não esgotar a memória.
   */
  function rateLimit(key: string, now = Date.now()) {
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + 60_000 });
      return;
    }
    entry.count += 1;
    if (entry.count > rateLimitPerMinute) {
      throw new HttpError(429, 'muitas requisições, tente de novo em instantes', {
        'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)),
      });
    }
  }

  /** Recusa requisições de páginas web de outra origem (defesa contra CSRF). */
  function checkOrigin(req: IncomingMessage) {
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.includes(origin)) throw new HttpError(403, 'origem não permitida');
  }

  /** Identifica o aparelho pelo cabeçalho Authorization: Bearer <token>. */
  function authenticate(req: IncomingMessage): Device {
    const match = /^Bearer ([A-Za-z0-9_-]{20,100})$/.exec(req.headers.authorization ?? '');
    const device = match ? db.findDevice(match[1]) : null;
    if (!device) throw new HttpError(401, 'token ausente ou inválido', { 'WWW-Authenticate': 'Bearer' });
    return device;
  }

  /** Lê a versão esperada do cabeçalho If-Match (ex.: "3"), obrigatória para alterar a vaga. */
  function expectedVersion(req: IncomingMessage): number {
    const match = /^"?(\d{1,15})"?$/.exec(req.headers['if-match'] ?? '');
    if (!match) throw new HttpError(428, 'envie o cabeçalho If-Match com a versão atual');
    return Number(match[1]);
  }

  /** Lê o corpo JSON com limite de tamanho, exigindo Content-Type application/json. */
  async function readJson(req: IncomingMessage): Promise<unknown> {
    if (!/^application\/json\b/i.test(req.headers['content-type'] ?? '')) {
      throw new HttpError(415, 'o corpo deve ser application/json');
    }
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) throw new HttpError(413, 'corpo grande demais');
      chunks.push(chunk);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      throw new HttpError(400, 'JSON inválido');
    }
  }

  /** Escreve um evento SSE "vaga" com a versão como id. */
  function writeEvent(res: ServerResponse, state: RemoteState) {
    res.write(`event: spot\nid: ${state.version}\ndata: ${JSON.stringify(state)}\n\n`);
  }

  /** Envia o novo estado a todos os aparelhos conectados do mesmo usuário. */
  function broadcast(userId: number, state: RemoteState) {
    for (const res of streams.get(userId) ?? []) writeEvent(res, state);
  }

  /**
   * Abre o fluxo SSE do aparelho: manda o estado atual na hora (assim uma reconexão já
   * ressincroniza), depois cada mudança, e um comentário periódico para manter a conexão viva.
   */
  function openStream(req: IncomingMessage, res: ServerResponse, device: Device) {
    const set = streams.get(device.userId) ?? new Set();
    if (set.size >= maxStreamsPerUser) throw new HttpError(429, 'conexões em tempo real demais para este usuário');
    set.add(res);
    streams.set(device.userId, set);

    res.writeHead(200, {
      ...baseHeaders,
      'Content-Type': 'text/event-stream; charset=utf-8',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 5000\n\n');
    writeEvent(res, db.getState(device.userId));

    const heartbeat = setInterval(() => res.write(': ping\n\n'), heartbeatMs);
    req.socket.setTimeout(0);
    req.on('close', () => {
      clearInterval(heartbeat);
      set.delete(res);
      if (set.size === 0) streams.delete(device.userId);
    });
  }

  /** Executa a rota pedida; qualquer erro vira uma resposta JSON sem detalhes internos. */
  async function route(req: IncomingMessage, res: ServerResponse) {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;

    if (path === '/health' && req.method === 'GET') return sendJson(res, 200, { status: 'ok' });

    rateLimit(`ip:${req.socket.remoteAddress}`);
    checkOrigin(req);
    const device = authenticate(req);
    rateLimit(`device:${device.id}`);

    if (path === '/api/events' && req.method === 'GET') return openStream(req, res, device);

    if (path === '/api/spot') {
      if (req.method === 'GET') return sendJson(res, 200, db.getState(device.userId));

      if (req.method === 'PUT') {
        const expected = expectedVersion(req);
        const parsed = parseSpot(await readJson(req));
        if (!parsed.ok) throw new HttpError(400, parsed.error);
        const result = db.saveSpot(device, expected, parsed.value);
        if (result.conflict) return sendJson(res, 409, result.state);
        broadcast(device.userId, result.state);
        return sendJson(res, 200, result.state, { ETag: `"${result.state.version}"` });
      }

      if (req.method === 'DELETE') {
        const result = db.releaseSpot(device, expectedVersion(req));
        if (result.conflict) return sendJson(res, 409, result.state);
        broadcast(device.userId, result.state);
        return sendJson(res, 200, result.state, { ETag: `"${result.state.version}"` });
      }

      throw new HttpError(405, 'método não permitido', { Allow: 'GET, PUT, DELETE' });
    }

    throw new HttpError(404, 'rota não encontrada');
  }

  /** Ponto de entrada de cada requisição HTTP. */
  function handler(req: IncomingMessage, res: ServerResponse) {
    route(req, res).catch((e: unknown) => {
      if (res.headersSent) return res.end();
      if (e instanceof HttpError) return sendJson(res, e.status, { erro: e.message }, e.headers);
      console.error(e);
      sendJson(res, 500, { erro: 'erro interno' });
    });
  }

  /** Fecha todos os fluxos SSE abertos (usado ao desligar o servidor). */
  function closeStreams() {
    for (const set of streams.values()) for (const res of set) res.end();
    streams.clear();
  }

  return { handler, closeStreams };
}
