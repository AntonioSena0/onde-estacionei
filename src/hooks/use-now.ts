import { useEffect, useState } from 'react';

/** Devolve o horário atual (ms), atualizado a cada segundo, para contagens regressivas. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);
  return now;
}
