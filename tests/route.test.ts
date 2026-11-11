import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, straightRoute } from '../src/lib/route.ts';

const from = { latitude: -23.547, longitude: -46.639 };
const to = { latitude: -23.5505, longitude: -46.6333 };

test('parseRoute liga a sua posição e o carro às pontas da rota do servidor', () => {
  const r = parseRoute(
    {
      code: 'Ok',
      routes: [{ distance: 950.9, duration: 764.5, geometry: { coordinates: [[-46.6393, -23.5468], [-46.6335, -23.5503]] } }],
    },
    from,
    to,
  );
  assert.ok(r);
  assert.deepEqual(r.coords[0], from);
  assert.deepEqual(r.coords.at(-1), to);
  assert.equal(r.coords.length, 4);
  assert.equal(r.minutes, 13);
  assert.equal(r.straight, false);
});

test('parseRoute recusa respostas vazias ou malformadas', () => {
  assert.equal(parseRoute({ code: 'NoRoute', routes: [] }, from, to), null);
  assert.equal(parseRoute(null, from, to), null);
  assert.equal(parseRoute({ routes: [{ distance: 1, duration: 1, geometry: { coordinates: [['x', 1], [2, 3]] } }] }, from, to), null);
});

test('straightRoute mede a linha reta e marca que não é rota real', () => {
  const r = straightRoute(from, to);
  assert.equal(r.coords.length, 2);
  assert.equal(r.minutes, null);
  assert.equal(r.straight, true);
  assert.ok(r.meters > 600 && r.meters < 800);
});
