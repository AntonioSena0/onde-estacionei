export type Coords = { latitude: number; longitude: number };

const EARTH_RADIUS_M = 6371000;

const FLOOR_HEIGHT_M = 3;

export const WARN_BEFORE_MS = 10 * 60 * 1000;

/** Calcula a distância em linha reta, em metros, entre dois pontos (fórmula de Haversine). */
export function distanceMeters(a: Coords, b: Coords): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Converte a pressão do ar (hPa) em altitude aproximada (m) pela fórmula barométrica padrão. */
export function altitudeFromPressure(hPa: number): number {
  return 44330 * (1 - Math.pow(hPa / 1013.25, 1 / 5.255));
}

/**
 * Diz quantos andares o carro está acima (positivo) ou abaixo (negativo) da pessoa.
 * Usa 3 m por andar; em prédios com pé-direito alto pode errar por 1 andar.
 */
export function floorDelta(carAltitude: number, currentAltitude: number): number {
  return Math.round((carAltitude - currentAltitude) / FLOOR_HEIGHT_M);
}

/** Formata metros como "42 m" ou "1,5 km"; mostra "—" quando a distância é desconhecida. */
export function formatDistance(m: number | null): string {
  if (m == null) return '—';
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

/** Formata o tempo restante como "12:04" ou "1:05:09"; tempo negativo vira "0:00". */
export function formatRemaining(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** Formata um instante (ms) como hora local "HH:MM". */
export function formatClock(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Calcula quando avisar: 10 minutos antes de vencer, ou logo em seguida se já faltar menos que isso. */
export function warnAt(expiresAt: number, now = Date.now()): number {
  return Math.max(expiresAt - WARN_BEFORE_MS, now + 1000);
}

/** Calcula o retângulo [oeste, sul, leste, norte] que contém todos os pontos, para enquadrar a rota no mapa. */
export function boundsOf(points: Coords[]): [number, number, number, number] {
  const lons = points.map((p) => p.longitude);
  const lats = points.map((p) => p.latitude);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

/** Calcula o fim do parquímetro a partir de agora somando a duração escolhida em minutos. */
export function expiryFrom(minutes: number, now = Date.now()): number {
  return now + minutes * 60_000;
}
