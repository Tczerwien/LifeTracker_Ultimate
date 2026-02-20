import { useState, useEffect } from 'react';

const NARROW_THRESHOLD = 768;

export function useNarrowWindow(): boolean {
  const [isNarrow, setIsNarrow] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < NARROW_THRESHOLD,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(`(max-width: ${NARROW_THRESHOLD - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsNarrow(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isNarrow;
}
