import { test } from 'node:test';
import assert from 'node:assert/strict';
import { straightRoute } from '../src/lib/route.ts';
import { paddedBounds, routeStyle } from '../src/lib/widget-map.ts';

const me = { latitude: -23.547, longitude: -46.639 };
const car = { latitude: -23.5505, longitude: -46.6333 };

test('routeStyle acrescenta rota, você e carro sem mexer no estilo original', () => {
  const base = { version: 8, sources: { osm: {} }, layers: [{ id: 'fundo' }] };
  const style = routeStyle(base, car, straightRoute(me, car));
  assert.deepEqual(base.layers, [{ id: 'fundo' }]);
  assert.ok(style.sources?.osm);
  const ids = (style.layers as { id: string }[]).map((l) => l.id);
  assert.deepEqual(ids, ['fundo', 'oe-route-casing', 'oe-route', 'oe-me', 'oe-car', 'oe-car-p']);
  const tracejada = (style.layers as { id: string; paint?: Record<string, unknown> }[]).find((l) => l.id === 'oe-route');
  assert.ok(tracejada?.paint?.['line-dasharray'], 'rota em linha reta fica tracejada');
});

test('routeStyle sem rota desenha só o carro', () => {
  const style = routeStyle({ layers: [] }, car, null);
  const data = (style.sources?.oe as { data: { features: { properties: { kind: string } }[] } }).data;
  assert.deepEqual(data.features.map((f) => f.properties.kind), ['car']);
});

test('paddedBounds deixa folga em volta dos dois pontos', () => {
  const [w, s, e, n] = paddedBounds([me, car]);
  assert.ok(w < me.longitude && e > car.longitude);
  assert.ok(s < car.latitude && n > me.latitude);
});
