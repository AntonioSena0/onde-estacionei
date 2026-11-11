import { useEffect, useState } from 'react';
import { Barometer } from 'expo-sensors';

/** Lê a pressão do ar (hPa) a cada 2 segundos, se o aparelho tiver barômetro; null enquanto não houver leitura. */
export function usePressure(): number | null {
  const [pressure, setPressure] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    let sub: { remove: () => void } | undefined;
    Barometer.isAvailableAsync().then((ok) => {
      if (!ok || !alive) return;
      Barometer.setUpdateInterval(2000);
      sub = Barometer.addListener((m) => setPressure(m.pressure));
    });
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);

  return pressure;
}
