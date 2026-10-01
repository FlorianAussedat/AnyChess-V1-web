import { cloudSyncEngine } from './cloudStore.ts';

export function onCloudAppState(state: string): void {
  if (state !== 'active') return;
  const { status, user } = cloudSyncEngine.getState();
  if (user && (status === 'pending' || status === 'offline' || status === 'error')) {
    void cloudSyncEngine.sync();
  }
}

export function onCloudNetworkOnline(): void {
  const { status, user } = cloudSyncEngine.getState();
  if (user && (status === 'pending' || status === 'offline' || status === 'error')) {
    void cloudSyncEngine.sync();
  }
}

let bound = false;
let unbind: (() => void) | null = null;

export function bindCloudLifecycle(): () => void {
  if (bound) return unbind ?? (() => {});
  bound = true;
  const cleanups: Array<() => void> = [];
  try {
    const rn = require('react-native') as {
      AppState: {
        addEventListener: (
          event: string,
          cb: (state: string) => void,
        ) => { remove: () => void };
      };
    };
    const sub = rn.AppState.addEventListener('change', onCloudAppState);
    cleanups.push(() => {
      try {
        sub.remove();
      } catch {
        /* ignore */
      }
    });
  } catch {
    // Node tests / environments without react-native
  }
  const onlineTarget = (globalThis as { addEventListener?: typeof addEventListener }).addEventListener;
  const offlineRemove = (globalThis as { removeEventListener?: typeof removeEventListener })
    .removeEventListener;
  if (typeof onlineTarget === 'function') {
    onlineTarget.call(globalThis, 'online', onCloudNetworkOnline);
    cleanups.push(() => {
      offlineRemove?.call(globalThis, 'online', onCloudNetworkOnline);
    });
  }
  unbind = () => {
    bound = false;
    for (const cleanup of cleanups) cleanup();
    unbind = null;
  };
  return unbind;
}
