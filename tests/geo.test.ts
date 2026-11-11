import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  altitudeFromPressure, boundsOf, distanceMeters, expiryFrom, floorDelta,
  formatDistance, formatRemaining, warnAt, WARN_BEFORE_MS,
} from '../src/lib/geo.ts';

test('distanceMeters mede ~120 m entre a Praça da Sé e a Catedral', () => {
  const d = distanceMeters({ latitude: -23.5503, longitude: -46.6339 }, { latitude: -23.5514, longitude: -46.6342 });
  assert.ok(d > 100 && d < 140, `distância ${d}`);
  assert.equal(distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 }), 0);
});

test('altitudeFromPressure é zero na pressão do nível do mar', () => {
  assert.ok(Math.abs(altitudeFromPressure(1013.25)) < 0.01);
});

test('floorDelta transforma ~9 m de diferença em 3 andares, com sinal', () => {
  const ground = altitudeFromPressure(1000);
  const up3 = altitudeFromPressure(1000 - 9 * 0.12);
  assert.equal(floorDelta(up3, ground), 3);
  assert.equal(floorDelta(ground, up3), -3);
});

test('formatDistance usa metros e quilômetros com vírgula', () => {
  assert.equal(formatDistance(42.4), '42 m');
  assert.equal(formatDistance(1530), '1,5 km');
  assert.equal(formatDistance(null), '—');
});

test('formatRemaining formata minutos, horas e tempo vencido', () => {
  assert.equal(formatRemaining(65_000), '1:05');
  assert.equal(formatRemaining(3_725_000), '1:02:05');
  assert.equal(formatRemaining(-5000), '0:00');
});

test('warnAt avisa 10 min antes, ou logo em seguida se já faltar menos', () => {
  const now = 1_000_000;
  assert.equal(warnAt(now + 60 * 60_000, now), now + 60 * 60_000 - WARN_BEFORE_MS);
  assert.equal(warnAt(now + 5 * 60_000, now), now + 1000);
});

test('boundsOf devolve [oeste, sul, leste, norte] de todos os pontos', () => {
  const b = boundsOf([
    { latitude: -23.5, longitude: -46.7 },
    { latitude: -23.6, longitude: -46.6 },
    { latitude: -23.55, longitude: -46.65 },
  ]);
  assert.deepEqual(b, [-46.7, -23.6, -46.6, -23.5]);
});

test('expiryFrom soma a duração em minutos', () => {
  assert.equal(expiryFrom(30, 0), 30 * 60_000);
});
