import type { Spot } from './validation.ts';

export type LocalState = { spot: Spot | null; version: number; dirty: boolean };
export type RemoteState = { spot: Spot | null; version: number };
type SyncAction = 'push' | 'delete' | 'pull' | 'none';

/**
 * Decide o que fazer quando o estado do servidor chega (pelo SSE ou por GET).
 * Mudança local pendente é enviada (o servidor recusa se outra pessoa mudou antes, e então
 * o servidor vence); sem pendência, o aparelho só copia o servidor quando a versão difere.
 */
export function reconcile(local: LocalState, remote: RemoteState): SyncAction {
  if (local.dirty) {
    if (local.spot) return 'push';
    return remote.spot ? 'delete' : 'pull';
  }
  return remote.version === local.version ? 'none' : 'pull';
}
