export type Spot = {
  latitude: number;
  longitude: number;
  savedAt: number;
  altitude: number | null;
  floor: string;
  note: string;
  address: string;
  postalCode: string;
  expiresAt: number | null;
};

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const MAX_FLOOR = 20;
export const MAX_NOTE = 120;
const MAX_ADDRESS = 160;
const MAX_PARKING_MS = 7 * 24 * 60 * 60 * 1000;

const FORBIDDEN_TEXT = /[<>\u0000-\u001f\u007f]/;

/** Verifica se o valor é um número finito dentro do intervalo [min, max]. */
function inRange(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
}

/**
 * Limpa e valida um texto digitado pelo usuário: corta espaços, limita o tamanho e
 * rejeita "<", ">" e caracteres de controle, que não fazem sentido aqui e são vetores de XSS/injeção.
 */
export function cleanText(v: unknown, max: number): Result<string> {
  if (v == null) return { ok: true, value: '' };
  if (typeof v !== 'string') return { ok: false, error: 'deve ser texto' };
  const s = v.trim();
  if (s.length > max) return { ok: false, error: `deve ter no máximo ${max} caracteres` };
  if (FORBIDDEN_TEXT.test(s)) return { ok: false, error: 'contém caracteres não permitidos' };
  return { ok: true, value: s };
}

/**
 * Valida os dados de uma vaga vindos de fora (rede ou formulário) e devolve um objeto novo
 * só com os campos conhecidos, para que campos extras nunca cheguem ao banco.
 */
export function parseSpot(input: unknown): Result<Spot> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, error: 'corpo deve ser um objeto JSON' };
  }
  const o = input as Record<string, unknown>;
  if (!inRange(o.latitude, -90, 90)) return { ok: false, error: 'latitude inválida' };
  if (!inRange(o.longitude, -180, 180)) return { ok: false, error: 'longitude inválida' };
  if (!Number.isSafeInteger(o.savedAt) || (o.savedAt as number) <= 0) {
    return { ok: false, error: 'savedAt inválido' };
  }
  const savedAt = o.savedAt as number;
  if (o.altitude != null && !inRange(o.altitude, -500, 9000)) return { ok: false, error: 'altitude inválida' };
  if (
    o.expiresAt != null &&
    (!Number.isSafeInteger(o.expiresAt) ||
      (o.expiresAt as number) <= savedAt ||
      (o.expiresAt as number) > savedAt + MAX_PARKING_MS)
  ) {
    return { ok: false, error: 'expiresAt inválido' };
  }
  const floor = cleanText(o.floor, MAX_FLOOR);
  if (!floor.ok) return { ok: false, error: `andar ${floor.error}` };
  const note = cleanText(o.note, MAX_NOTE);
  if (!note.ok) return { ok: false, error: `referência ${note.error}` };
  const address = cleanText(o.address, MAX_ADDRESS);
  if (!address.ok) return { ok: false, error: `endereço ${address.error}` };
  if (o.postalCode != null && o.postalCode !== '' && !(typeof o.postalCode === 'string' && /^\d{8}$/.test(o.postalCode))) {
    return { ok: false, error: 'CEP deve ter 8 dígitos' };
  }

  return {
    ok: true,
    value: {
      latitude: o.latitude,
      longitude: o.longitude,
      savedAt,
      altitude: (o.altitude as number | null | undefined) ?? null,
      floor: floor.value,
      note: note.value,
      address: address.value,
      postalCode: (o.postalCode as string | null | undefined) ?? '',
      expiresAt: (o.expiresAt as number | null | undefined) ?? null,
    },
  };
}

/**
 * Valida o estado que chega do servidor ({ version, vaga }) antes de gravá-lo no aparelho,
 * para que uma resposta corrompida ou adulterada não entre no banco local.
 */
export function parseRemoteState(input: unknown): { version: number; spot: Spot | null } | null {
  if (typeof input !== 'object' || input === null) return null;
  const o = input as Record<string, unknown>;
  if (!Number.isSafeInteger(o.version) || (o.version as number) < 0) return null;
  if (o.spot === null) return { version: o.version as number, spot: null };
  const spot = parseSpot(o.spot);
  return spot.ok ? { version: o.version as number, spot: spot.value } : null;
}

/**
 * Diz se a URL do servidor protege os dados em trânsito: exige HTTPS, aceitando HTTP
 * só em desenvolvimento e só para o próprio computador ou o emulador Android.
 */
export function isSecureUrl(url: string, dev: boolean): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol === 'https:') return true;
  return dev && u.protocol === 'http:' && ['localhost', '127.0.0.1', '10.0.2.2'].includes(u.hostname);
}
