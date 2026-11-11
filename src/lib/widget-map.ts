import { boundsOf, type Coords } from './geo.ts';
import type { WalkingRoute } from './route.ts';

type Style = { sources?: Record<string, unknown>; layers?: unknown[] } & Record<string, unknown>;

const SIGN = '#1D4FA8';
const MARKING = '#F5C400';
const ASPHALT = '#33373B';

/**
 * Acrescenta ao estilo do mapa a rota a pé, a sua posição e o carro, para virar imagem estática.
 * O carro é um círculo azul com "P" (a logo) e você é um ponto amarelo; a linha é tracejada
 * quando a rota é só a reta até o carro. Não altera o estilo recebido.
 */
export function routeStyle(base: Style, car: Coords, route: WalkingRoute | null): Style {
  const point = (c: Coords, kind: string) => ({
    type: 'Feature',
    properties: { kind },
    geometry: { type: 'Point', coordinates: [c.longitude, c.latitude] },
  });
  const features: unknown[] = [point(car, 'car')];
  if (route) {
    features.unshift({
      type: 'Feature',
      properties: { kind: 'route' },
      geometry: { type: 'LineString', coordinates: route.coords.map((c) => [c.longitude, c.latitude]) },
    });
    features.push(point(route.coords[0], 'me'));
  }
  const kind = (k: string) => ['==', ['get', 'kind'], k];
  return {
    ...base,
    sources: { ...base.sources, oe: { type: 'geojson', data: { type: 'FeatureCollection', features } } },
    layers: [
      ...(base.layers ?? []),
      { id: 'oe-route-casing', type: 'line', source: 'oe', filter: kind('route'), layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-width': 9 } },
      {
        id: 'oe-route', type: 'line', source: 'oe', filter: kind('route'),
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': SIGN, 'line-width': 5, ...(route?.straight ? { 'line-dasharray': [1.5, 1.5] } : {}) },
      },
      { id: 'oe-me', type: 'circle', source: 'oe', filter: kind('me'), paint: { 'circle-radius': 7, 'circle-color': MARKING, 'circle-stroke-color': ASPHALT, 'circle-stroke-width': 3 } },
      { id: 'oe-car', type: 'circle', source: 'oe', filter: kind('car'), paint: { 'circle-radius': 13, 'circle-color': SIGN, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 3 } },
      {
        id: 'oe-car-p', type: 'symbol', source: 'oe', filter: kind('car'),
        layout: { 'text-field': 'P', 'text-font': ['Noto Sans Bold'], 'text-size': 15, 'text-allow-overlap': true },
        paint: { 'text-color': '#FFFFFF' },
      },
    ],
  };
}

/**
 * Caixa que enquadra a rota com folga nas bordas, para o carro e você não ficarem cortados.
 * Rotas muito curtas ganham uma folga mínima, senão o mapa daria zoom até a calçada.
 */
export function paddedBounds(points: Coords[]): [number, number, number, number] {
  const [w, s, e, n] = boundsOf(points);
  const pad = Math.max(e - w, n - s) * 0.25 + 0.0006;
  return [w - pad, s - pad, e + pad, n + pad];
}
