import type { Coords } from './geo.ts';
import { cleanText } from './validation.ts';

export type Address = { postalCode: string; street: string; number: string; district: string; city: string; state: string };

const POSTAL_CODE_URL = process.env.EXPO_PUBLIC_POSTAL_CODE_URL ?? 'https://viacep.com.br/ws';
const GEOCODER_URL = process.env.EXPO_PUBLIC_GEOCODER_URL ?? 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'OndeEstacionei/1.0 (projeto escolar)';
const GEOCODER_INTERVAL_MS = 1100;
const TIMEOUT_MS = 8000;

let lastGeocoderCall = 0;

/** Extrai os 8 dígitos de um CEP digitado com ou sem traço; devolve null se não houver exatamente 8. */
export function normalizePostalCode(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  return /^\d{8}$/.test(digits) ? digits : null;
}

/** Aplica a máscara 00000-000 enquanto a pessoa digita, descartando o que não for número. */
export function maskPostalCode(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** Monta o endereço em uma linha, ex.: "Praça da Sé, 100 - Sé, São Paulo/SP", pulando partes vazias. */
export function formatAddress(a: Partial<Address>): string {
  const street = [a.street, a.number].filter(Boolean).join(', ');
  const place = [a.city, a.state].filter(Boolean).join('/');
  return [street, [a.district, place].filter(Boolean).join(', ')].filter(Boolean).join(' - ');
}

/** Lê um campo de texto vindo de serviço externo, descartando o que não passar na validação. */
function safeText(v: unknown, max = 80): string {
  const r = cleanText(typeof v === 'string' ? v : '', max);
  return r.ok ? r.value : '';
}

/** Converte a resposta do ViaCEP em endereço; devolve null quando o CEP não existe. */
export function parseViaCep(json: unknown): Address | null {
  if (typeof json !== 'object' || json === null) return null;
  const o = json as Record<string, unknown>;
  const postalCode = normalizePostalCode(safeText(o.cep));
  if (o.erro || !postalCode) return null;
  return {
    postalCode,
    street: safeText(o.logradouro),
    number: '',
    district: safeText(o.bairro),
    city: safeText(o.localidade),
    state: safeText(o.uf, 2),
  };
}

/** Converte o primeiro resultado da busca do Nominatim em coordenadas válidas, ou null. */
export function parseSearch(json: unknown): Coords | null {
  const first = Array.isArray(json) ? (json[0] as Record<string, unknown> | undefined) : undefined;
  const latitude = Number(first?.lat);
  const longitude = Number(first?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

/** Converte a resposta do geocodificador reverso (coordenada para endereço) do Nominatim, ou null. */
export function parseReverse(json: unknown): Address | null {
  const a = (json as { address?: Record<string, unknown> } | null)?.address;
  if (!a) return null;
  const iso = safeText(a['ISO3166-2-lvl4']);
  return {
    postalCode: normalizePostalCode(safeText(a.postcode)) ?? '',
    street: safeText(a.road ?? a.pedestrian ?? a.footway),
    number: safeText(a.house_number, 10),
    district: safeText(a.suburb ?? a.neighbourhood ?? a.quarter),
    city: safeText(a.city ?? a.town ?? a.village ?? a.municipality),
    state: iso.startsWith('BR-') ? iso.slice(3) : '',
  };
}

/** Faz um GET com tempo máximo de espera e devolve o JSON da resposta. */
async function getJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Consulta o Nominatim respeitando a política de uso do OpenStreetMap: no máximo uma
 * requisição por segundo e um User-Agent que identifica o app. Uma falha de rede ganha uma
 * segunda tentativa, porque a primeira conexão do aparelho costuma ser a mais lenta.
 */
async function geocoder(path: string, attempt = 1): Promise<unknown> {
  const wait = lastGeocoderCall + GEOCODER_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastGeocoderCall = Date.now();
  try {
    return await getJson(`${GEOCODER_URL}${path}`, { 'User-Agent': USER_AGENT, 'Accept-Language': 'pt-BR' });
  } catch (e) {
    if (attempt >= 2) throw e;
    return geocoder(path, attempt + 1);
  }
}

/** Busca rua, bairro, cidade e UF de um CEP no ViaCEP; null se o CEP não existir. */
export async function lookupPostalCode(postalCode: string): Promise<Address | null> {
  return parseViaCep(await getJson(`${POSTAL_CODE_URL}/${postalCode}/json/`));
}

/** Encontra as coordenadas de um endereço no Brasil. */
export async function geocode(a: Address): Promise<Coords | null> {
  const q = encodeURIComponent([[a.street, a.number].filter(Boolean).join(' '), a.city, a.state].filter(Boolean).join(', '));
  return parseSearch(await geocoder(`/search?format=jsonv2&limit=1&countrycodes=br&q=${q}`));
}

/** Descobre o endereço (com CEP) mais próximo de uma coordenada. */
export async function reverseGeocode(c: Coords): Promise<Address | null> {
  return parseReverse(await geocoder(`/reverse?format=jsonv2&zoom=18&lat=${c.latitude}&lon=${c.longitude}`));
}
