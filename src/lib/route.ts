import { distanceMeters, type Coords } from './geo.ts';

export type WalkingRoute = { coords: Coords[]; meters: number; minutes: number | null; straight: boolean };

const ROUTING_URL =
  process.env.EXPO_PUBLIC_ROUTING_URL ?? 'https://routing.openstreetmap.de/routed-foot/route/v1/foot';
const TIMEOUT_MS = 10_000;

/**
 * Lê a resposta do OSRM e devolve a rota com a sua posição e o carro nas pontas: o servidor
 * "encaixa" os pontos na calçada mais próxima, e sem as pontas a linha pararia antes do carro.
 */
export function parseRoute(json: unknown, from: Coords, to: Coords): WalkingRoute | null {
  const route = (json as { code?: string; routes?: unknown[] } | null)?.routes?.[0] as
    | { distance?: unknown; duration?: unknown; geometry?: { coordinates?: unknown } }
    | undefined;
  const points = route?.geometry?.coordinates;
  if (!Array.isArray(points) || points.length < 2) return null;
  if (typeof route?.distance !== 'number' || typeof route.duration !== 'number') return null;
  const coords: Coords[] = [];
  for (const p of points) {
    if (!Array.isArray(p) || typeof p[0] !== 'number' || typeof p[1] !== 'number') return null;
    coords.push({ longitude: p[0], latitude: p[1] });
  }
  return {
    coords: [from, ...coords, to],
    meters: route.distance,
    minutes: Math.max(1, Math.round(route.duration / 60)),
    straight: false,
  };
}

/** Caminho em linha reta, usado sem internet ou sem rota: ainda aponta a direção do carro. */
export function straightRoute(from: Coords, to: Coords): WalkingRoute {
  return { coords: [from, to], meters: distanceMeters(from, to), minutes: null, straight: true };
}

/** Busca a rota a pé até o carro em um servidor OSRM gratuito (sem chave de API). */
export async function fetchWalkingRoute(from: Coords, to: Coords): Promise<WalkingRoute> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `${ROUTING_URL}/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson`,
      { signal: controller.signal },
    );
    return parseRoute(await res.json(), from, to) ?? straightRoute(from, to);
  } catch {
    return straightRoute(from, to);
  } finally {
    clearTimeout(timer);
  }
}
