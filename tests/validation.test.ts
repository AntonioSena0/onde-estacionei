import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanText, isSecureUrl, parseRemoteState, parseSpot, MAX_NOTE } from '../src/lib/validation.ts';

const base = { latitude: -23.55, longitude: -46.63, savedAt: 1_700_000_000_000 };

test('parseSpot aceita uma vaga válida e preenche os opcionais', () => {
  const r = parseSpot(base);
  assert.deepEqual(r, {
    ok: true,
    value: { ...base, altitude: null, floor: '', note: '', address: '', postalCode: '', expiresAt: null },
  });
});

test('parseSpot descarta campos desconhecidos (sem atribuição em massa)', () => {
  const r = parseSpot({ ...base, user_id: 99, __proto__: { admin: true } });
  assert.ok(r.ok);
  assert.deepEqual(Object.keys(r.value).sort(), ['address', 'altitude', 'expiresAt', 'floor', 'latitude', 'longitude', 'note', 'postalCode', 'savedAt']);
});

test('parseSpot recusa coordenadas, datas e tipos inválidos', () => {
  assert.equal(parseSpot(null).ok, false);
  assert.equal(parseSpot([]).ok, false);
  assert.equal(parseSpot({ ...base, latitude: 91 }).ok, false);
  assert.equal(parseSpot({ ...base, longitude: '10' }).ok, false);
  assert.equal(parseSpot({ ...base, latitude: NaN }).ok, false);
  assert.equal(parseSpot({ ...base, savedAt: 1.5 }).ok, false);
  assert.equal(parseSpot({ ...base, expiresAt: base.savedAt - 1 }).ok, false);
  assert.equal(parseSpot({ ...base, expiresAt: base.savedAt + 8 * 24 * 3600_000 }).ok, false);
  assert.equal(parseSpot({ ...base, postalCode: '0100100' }).ok, false);
  assert.equal(parseSpot({ ...base, postalCode: 'abcdefgh' }).ok, false);
  assert.equal(parseSpot({ ...base, address: '<b>x</b>' }).ok, false);
  assert.equal(parseSpot({ ...base, altitude: 99_999 }).ok, false);
});

test('cleanText bloqueia marcação HTML e caracteres de controle (XSS)', () => {
  assert.equal(cleanText('<script>alert(1)</script>', 120).ok, false);
  assert.equal(cleanText('<img src=x onerror=alert(1)>', 120).ok, false);
  assert.equal(cleanText('Pilar\u0000B14', 120).ok, false);
  assert.deepEqual(cleanText('  Pilar B14 ', 120), { ok: true, value: 'Pilar B14' });
  assert.equal(cleanText('x'.repeat(MAX_NOTE + 1), MAX_NOTE).ok, false);
  assert.equal(cleanText(42, 10).ok, false);
});

test('parseRemoteState aceita só respostas íntegras do servidor', () => {
  assert.deepEqual(parseRemoteState({ version: 3, spot: null }), { version: 3, spot: null });
  assert.equal(parseRemoteState({ version: 3, spot: base })?.spot?.latitude, base.latitude);
  assert.equal(parseRemoteState({ version: -1, spot: null }), null);
  assert.equal(parseRemoteState({ version: 3, spot: { ...base, note: '<b>' } }), null);
  assert.equal(parseRemoteState({ version: 3 }), null);
  assert.equal(parseRemoteState('{}'), null);
});

test('isSecureUrl exige HTTPS e só libera HTTP local em desenvolvimento', () => {
  assert.equal(isSecureUrl('https://api.exemplo.com', false), true);
  assert.equal(isSecureUrl('http://api.exemplo.com', true), false);
  assert.equal(isSecureUrl('http://10.0.2.2:3333', true), true);
  assert.equal(isSecureUrl('http://10.0.2.2:3333', false), false);
  assert.equal(isSecureUrl('javascript:alert(1)', true), false);
  assert.equal(isSecureUrl('não é url', true), false);
});
