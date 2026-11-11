import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import type { Coords } from '@/lib/geo';

type LocationAccess = 'checking' | 'pending' | 'granted' | 'denied';

/**
 * Acompanha a posição da pessoa enquanto a tela está aberta, só se a permissão já foi dada
 * (o pedido acontece na tela de permissões). Reconfere a permissão ao voltar das configurações.
 */
export function usePosition(): { position: Coords | null; access: LocationAccess } {
  const [position, setPosition] = useState<Coords | null>(null);
  const [access, setAccess] = useState<LocationAccess>('checking');

  const recheck = useCallback(() => {
    Location.getForegroundPermissionsAsync().then(({ status }) =>
      setAccess(status === 'granted' ? 'granted' : status === 'undetermined' ? 'pending' : 'denied'),
    );
  }, []);

  useEffect(() => {
    recheck();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && recheck());
    return () => sub.remove();
  }, [recheck]);

  useEffect(() => {
    if (access !== 'granted') return;
    let watcher: Location.LocationSubscription | undefined;
    let alive = true;
    Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 5 }, (loc) =>
      setPosition(loc.coords),
    ).then((w) => (alive ? (watcher = w) : w.remove()));
    return () => {
      alive = false;
      watcher?.remove();
    };
  }, [access]);

  return { position, access };
}
