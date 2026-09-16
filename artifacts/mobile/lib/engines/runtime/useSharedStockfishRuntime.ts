/**
 * React hook — observe shared Stockfish runtime (endgame modes).
 *
 * useSyncExternalStore requires a stable snapshot reference when values
 * are unchanged; SharedStockfishRuntime caches and reuses its snapshot.
 */
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import {
  getSharedStockfishRuntime,
  type SharedStockfishSnapshot,
} from './SharedStockfishRuntime.ts';

function subscribe(onStoreChange: () => void): () => void {
  return getSharedStockfishRuntime().subscribe(() => onStoreChange());
}

function getSnapshot(): SharedStockfishSnapshot {
  return getSharedStockfishRuntime().getSnapshot();
}

export function useSharedStockfishRuntime(options?: { prewarm?: boolean }) {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const runtime = getSharedStockfishRuntime();

  useEffect(() => {
    if (options?.prewarm) runtime.prewarm();
  }, [options?.prewarm, runtime]);

  useEffect(() => {
    void runtime.ensureService().catch(() => {
      /* error in snapshot */
    });
  }, [runtime]);

  const retry = useCallback(async () => {
    await runtime.retry();
  }, [runtime]);

  const engineReady =
    snap.status === 'ready' || snap.status === 'thinking';

  return {
    snapshot: snap,
    engineReady,
    isLoading:
      snap.status === 'uninitialized' || snap.status === 'loading',
    isError: snap.status === 'error',
    isUnavailable: snap.status === 'unavailable',
    service: runtime.getService(),
    retry,
    runtime,
  };
}

export type { SharedStockfishSnapshot };
