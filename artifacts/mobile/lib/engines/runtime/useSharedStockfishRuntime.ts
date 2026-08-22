/**
 * React hook — observe shared Stockfish runtime (endgame modes).
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  getSharedStockfishRuntime,
  type SharedStockfishSnapshot,
} from './SharedStockfishRuntime.ts';

export function useSharedStockfishRuntime(options?: { prewarm?: boolean }) {
  const runtime = getSharedStockfishRuntime();

  const subscribe = useCallback(
    (onStoreChange: () => void) => runtime.subscribe(() => onStoreChange()),
    [runtime],
  );

  const getSnapshot = useCallback(
    () => runtime.getSnapshot(),
    [runtime],
  );

  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

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
