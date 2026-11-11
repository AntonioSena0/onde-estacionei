import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.ts';
import { openDatabase } from '../server/db.ts';

const db = openDatabase(':memory:');
const app = createApp({ db, allowedOrigins: ['https://painel.exemplo.com'], rateLimitPerMinute: 1000 });
const server = http.createServer(app.handler);
let url = '';

const ana = db.createDevice({ userName: 'Ana', name: 'Celular da Ana' });
const anaTablet = db.createDevice({ userId: ana.userId, name: 'Tablet da Ana' });
const bruno = db.createDevice({ userName: 'Bruno', name: 'Celular do Bruno' });

const spot = { latitude: -23.55, longitude: -46.63, savedAt: 1_700_000_000_000, floor: 'G2', note: 'Pilar B14' };

/** Faz uma requisição à API de teste com o token informado e cabeçalhos extras. */
function call(path: string, token: string | null, init: RequestInit & { headers?: Record<string, string> } = {}) {
  return fetch(url + path, {
    ...init,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  });
}

/** Grava a vaga do usuário com a versão esperada informada. */
function put(token: string, version: number, body: unknown) {
  return call('/api/spot', token, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'If-Match': `"${version}"` },
    body: JSON.stringify(body),
  });
}

/** Lê eventos SSE de um corpo em streaming até encontrar o próximo evento completo. */
async function nextEvent(reader: ReadableStreamDefaultReader<Uint8Array>, buffer: { text: string }) {
  const decoder = new TextDecoder();
  while (!buffer.text.includes('event: spot')) buffer.text += decoder.decode((await reader.read()).value);
  const start = buffer.text.indexOf('event: spot');
  while (!buffer.text.slice(start).includes('\n\n')) buffer.text += decoder.decode((await reader.read()).value);
  const end = buffer.text.indexOf('\n\n', start);
  const block = buffer.text.slice(start, end);
  buffer.text = buffer.text.slice(end + 2);
  return JSON.parse(block.split('\n').find((l) => l.startsWith('data: '))!.slice(6));
}

before(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  app.closeStreams();
  server.close();
  db.close();
});

test('health responde sem autenticação e com cabeçalhos de segurança', async () => {
  const res = await call('/health', null);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.match(res.headers.get('content-security-policy') ?? '', /default-src 'none'/);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(res.headers.get('access-control-allow-origin'), null);
});

test('sem token ou com token inválido responde 401', async () => {
  assert.equal((await call('/api/spot', null)).status, 401);
  assert.equal((await call('/api/spot', 'x'.repeat(43))).status, 401);
});

test('o servidor guarda só o hash do token', () => {
  assert.equal(db.findDevice(ana.token)?.userId, ana.userId);
  assert.equal(db.findDevice(ana.token.slice(0, -1) + (ana.token.endsWith('A') ? 'B' : 'A')), null);
});

test('requisição de outra origem é recusada (CSRF)', async () => {
  const res = await call('/api/spot', ana.token, { headers: { Origin: 'https://site-malicioso.com' } });
  assert.equal(res.status, 403);
  const ok = await call('/api/spot', ana.token, { headers: { Origin: 'https://painel.exemplo.com' } });
  assert.equal(ok.status, 200);
});

test('escrita sem JSON (ex.: formulário HTML forjado) responde 415', async () => {
  const res = await call('/api/spot', ana.token, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'If-Match': '"0"' },
    body: 'latitude=1',
  });
  assert.equal(res.status, 415);
});

test('escrita sem If-Match responde 428', async () => {
  const res = await call('/api/spot', ana.token, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(spot),
  });
  assert.equal(res.status, 428);
});

test('texto com HTML é recusado (XSS) e corpo grande demais responde 413', async () => {
  assert.equal((await put(ana.token, 0, { ...spot, note: '<script>alert(1)</script>' })).status, 400);
  assert.equal((await put(ana.token, 0, { ...spot, note: 'x'.repeat(5000) })).status, 413);
});

test('salva, lê e libera a vaga com controle de versão', async () => {
  const saved = await put(ana.token, 0, spot);
  assert.equal(saved.status, 200);
  const state = await saved.json();
  assert.equal(state.version, 1);
  assert.equal(state.spot.note, 'Pilar B14');

  const fromTablet = await (await call('/api/spot', anaTablet.token)).json();
  assert.deepEqual(fromTablet, state);

  const stale = await put(anaTablet.token, 0, { ...spot, floor: 'G3' });
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).spot.floor, 'G2');

  const released = await call('/api/spot', ana.token, { method: 'DELETE', headers: { 'If-Match': '"1"' } });
  assert.deepEqual(await released.json(), { version: 2, spot: null });
});

test('endereço e CEP vão e voltam pela API, e CEP inválido é recusado', async () => {
  const before = await (await call('/api/spot', bruno.token)).json();
  const withAddress = { ...spot, address: 'Praça da Sé, 100 - Sé, São Paulo/SP', postalCode: '01001000' };
  const saved = await (await put(bruno.token, before.version, withAddress)).json();
  assert.equal(saved.spot.address, withAddress.address);
  assert.equal(saved.spot.postalCode, '01001000');
  assert.equal((await put(bruno.token, saved.version, { ...withAddress, postalCode: '0100-100' })).status, 400);
  await call('/api/spot', bruno.token, { method: 'DELETE', headers: { 'If-Match': `"${saved.version}"` } });
});

test('reabrir o banco não reaplica migrações nem perde dados', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'oe-')), 'teste.db');
  const first = openDatabase(file);
  const device = first.createDevice({ userName: 'Carla', name: 'Celular' });
  first.close();
  const again = openDatabase(file);
  assert.equal(again.findDevice(device.token)?.userId, device.userId);
  again.close();
});

test('um usuário não vê a vaga de outro', async () => {
  await put(ana.token, 2, spot);
  const res = await (await call('/api/spot', bruno.token)).json();
  assert.equal(res.spot, null);
});

test('SSE envia o estado ao conectar e cada mudança em tempo real para os aparelhos do usuário', async () => {
  const controller = new AbortController();
  const res = await call('/api/events', anaTablet.token, { signal: controller.signal });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /text\/event-stream/);
  const reader = res.body!.getReader();
  const buffer = { text: '' };

  const first = await nextEvent(reader, buffer);
  assert.equal(first.spot.floor, 'G2');

  await put(ana.token, first.version, { ...spot, floor: 'G5' });
  const second = await nextEvent(reader, buffer);
  assert.equal(second.version, first.version + 1);
  assert.equal(second.spot.floor, 'G5');
  controller.abort();
});

test('limite de requisições responde 429 com Retry-After', async () => {
  const small = createApp({ db, rateLimitPerMinute: 2 });
  const s = http.createServer(small.handler);
  await new Promise<void>((resolve) => s.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
  const headers = { Authorization: `Bearer ${bruno.token}` };
  await fetch(`${base}/api/spot`, { headers });
  await fetch(`${base}/api/spot`, { headers });
  const res = await fetch(`${base}/api/spot`, { headers });
  assert.equal(res.status, 429);
  assert.ok(res.headers.get('retry-after'));
  s.close();
});
