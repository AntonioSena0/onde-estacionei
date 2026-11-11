import EventSource from 'react-native-sse';
import { loadState, saveState, type StoredState } from './db';
import { cancelWarning, scheduleWarning } from './notifications';
import { reconcile, type LocalState, type RemoteState } from './reconcile';
import { getToken, setToken } from './secrets';
import { isSecureUrl, parseRemoteState, type Spot } from './validation';
import { refreshWidget } from '@/widget/parking-widget';

export type Connection = 'off' | 'connecting' | 'online' | 'offline' | 'rejected';
export type AppState = StoredState & { connection: Connection };

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');
const REQUEST_TIMEOUT_MS = 10_000;

let state: AppState | null = null;
let source: EventSource<'spot'> | null = null;
let queue: Promise<unknown> = Promise.resolve();
const listeners = new Set<(s: AppState) => void>();

/** Diz se há um servidor configurado no .env com uma URL que protege os dados em trânsito. */
export function apiConfigured(): boolean {
  return isSecureUrl(API_URL, __DEV__);
}

/** Avisa a tela (e quem mais estiver ouvindo) que o estado mudou. */
function emit() {
  for (const listener of listeners) listener(state!);
}

/** Registra quem quer ser avisado das mudanças; devolve a função que cancela o registro. */
export function subscribe(listener: (s: AppState) => void): () => void {
  listeners.add(listener);
  if (state) listener(state);
  return () => listeners.delete(listener);
}

/**
 * Executa operações uma de cada vez, na ordem em que chegaram, para que uma edição local
 * e um evento do servidor nunca gravem o banco ao mesmo tempo.
 */
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

/** Carrega o estado do banco local na primeira chamada e o mantém em memória. */
async function current(): Promise<AppState> {
  state ??= { ...(await loadState()), connection: 'off' };
  return state;
}

/** Atualiza só o status da conexão em tempo real. */
function setConnection(connection: Connection) {
  if (!state) return;
  state = { ...state, connection };
  emit();
}

/**
 * Grava um novo estado no banco local e o mostra na tela e no widget. Se o horário do
 * parquímetro mudou (aqui ou em outro aparelho), troca o aviso agendado neste aparelho.
 */
async function commit(next: LocalState) {
  const prev = await current();
  let notificationId = prev.notificationId;
  const expiresAt = next.spot?.expiresAt ?? null;
  if (expiresAt !== (prev.spot?.expiresAt ?? null)) {
    await cancelWarning(prev.notificationId);
    notificationId = expiresAt && expiresAt > Date.now() ? await scheduleWarning(expiresAt).catch(() => null) : null;
  }
  state = { ...next, notificationId, connection: prev.connection };
  await saveState(state);
  emit();
  refreshWidget();
}

/** Faz uma chamada à API com o token, a versão esperada e um tempo máximo de espera. */
async function request(method: 'PUT' | 'DELETE', version: number, body: Spot | null, token: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${API_URL}/api/spot`, {
      method,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'If-Match': `"${version}"`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Envia ao servidor a mudança local pendente. Em caso de conflito (outro aparelho mudou antes)
 * o servidor vence e o aparelho copia o estado dele. Sem rede, a mudança continua pendente
 * e é reenviada quando o tempo real reconectar.
 */
async function pushPending() {
  const s = await current();
  const token = await getToken();
  if (!s.dirty || !token || !apiConfigured()) return;
  try {
    const res = await request(s.spot ? 'PUT' : 'DELETE', s.version, s.spot, token);
    const remote = parseRemoteState(await res.json());
    if ((res.ok || res.status === 409) && remote) await commit({ ...remote, dirty: false });
  } catch {
    setConnection('offline');
  }
}

/** Decide o que fazer com o estado que chegou do servidor (ver `reconcile`). */
async function onRemote(remote: RemoteState) {
  const action = reconcile(await current(), remote);
  if (action === 'pull') await commit({ ...remote, dirty: false });
  else if (action === 'push' || action === 'delete') await pushPending();
}

/** Devolve a vaga atual já carregada em memória (usada para preencher o formulário de edição). */
export function currentSpot(): Spot | null {
  return state?.spot ?? null;
}

/** Carrega o estado salvo e avisa a tela. */
export function init(): Promise<void> {
  return serial(async () => {
    await current();
    emit();
  });
}

/** Salva ou libera a vaga neste aparelho (funciona offline) e tenta enviar ao servidor. */
export function setSpot(spot: Spot | null): Promise<void> {
  return serial(async () => {
    const s = await current();
    await commit({ spot, version: s.version, dirty: true });
    await pushPending();
  });
}

/** Encerra a conexão em tempo real, se houver. */
export function stopRealtime() {
  source?.removeAllEventListeners();
  source?.close();
  source = null;
}

/**
 * Abre a conexão SSE com o servidor. Cada evento traz o estado atual da vaga do usuário;
 * ao (re)conectar, o primeiro evento já ressincroniza o que mudou enquanto estava offline.
 * A biblioteca reconecta sozinha; um token recusado (401) encerra as tentativas.
 */
export async function startRealtime() {
  stopRealtime();
  await current();
  const token = await getToken();
  if (!token || !apiConfigured()) return setConnection('off');

  setConnection('connecting');
  const es = new EventSource<'spot'>(`${API_URL}/api/events`, {
    headers: { Authorization: `Bearer ${token}` },
    pollingInterval: 5000,
  });
  es.addEventListener('open', () => setConnection('online'));
  es.addEventListener('spot', (event) => {
    let remote: RemoteState | null = null;
    try {
      remote = parseRemoteState(JSON.parse(event.data ?? 'null'));
    } catch {}
    if (remote) serial(() => onRemote(remote));
  });
  es.addEventListener('error', (event) => {
    if ('xhrStatus' in event && event.xhrStatus === 401) {
      stopRealtime();
      return setConnection('rejected');
    }
    setConnection('offline');
  });
  source = es;
}

/** Conecta este aparelho ao servidor com o token recebido e começa a sincronizar. */
export async function connect(token: string) {
  await setToken(token.trim());
  await startRealtime();
}

/** Desconecta este aparelho: apaga o token e para o tempo real; a vaga continua salva localmente. */
export async function disconnect() {
  stopRealtime();
  await setToken(null);
  setConnection('off');
}
