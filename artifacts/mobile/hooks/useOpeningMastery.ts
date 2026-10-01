/**
 * Subscribe to opening-line mastery so Learning / Study re-render after Review.
 */
import { useCallback, useEffect, useState } from 'react';
import { openingMasteryStore } from '@/lib/repertoire';

export function useOpeningMastery() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    void openingMasteryStore.ensureLoaded().then(() => setTick((n) => n + 1));
    return openingMasteryStore.subscribe(() => setTick((n) => n + 1));
  }, []);

  const ready = tick > 0 || openingMasteryStore.getSnapshot().version === 1;

  const refresh = useCallback(async () => {
    await openingMasteryStore.ensureLoaded();
    setTick((n) => n + 1);
  }, []);

  return { ready, tick, store: openingMasteryStore, refresh };
}
