import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const DB_KEY = 'db-key';
const TOKEN_KEY = 'api-token';
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{20,100}$/;

/**
 * Devolve a chave de criptografia do banco local, criando uma aleatória de 256 bits no primeiro uso.
 * A chave fica no armazenamento seguro do sistema (Android Keystore / iOS Keychain).
 */
export async function getDbKey(): Promise<string> {
  const saved = await SecureStore.getItemAsync(DB_KEY);
  if (saved) return saved;
  const key = Array.from(Crypto.getRandomBytes(32), (b) => b.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync(DB_KEY, key);
  return key;
}

/** Lê o token deste aparelho no servidor, ou null se a sincronização não foi configurada. */
export function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

/** Guarda o token no armazenamento seguro depois de conferir o formato; null apaga o token. */
export async function setToken(token: string | null): Promise<void> {
  if (token == null) return SecureStore.deleteItemAsync(TOKEN_KEY);
  if (!TOKEN_FORMAT.test(token)) throw new Error('Token em formato inválido.');
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}
