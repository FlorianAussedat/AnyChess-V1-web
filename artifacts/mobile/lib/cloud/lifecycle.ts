import { cloudSyncEngine } from './cloudStore.ts';
import { subscribeSyncTransport } from './syncTransport.ts';
import type { CloudSyncStatus } from './types.ts';
import type { SyncTransport } from './wifiSyncPolicy.ts';

const RESUME_STATUSES: CloudSyncStatus[] = ['pending', 'offline', 'error', 'waiting_wifi'];

function resumeCloudSync(): void {
  const { status, user } = cloudSyncEngine.getState();
  if (user && RESUME_STATUSES.includes(status)) {
    void cloudSyncEngine.sync();
  }
}

export function onCloudAppState(state: string): void {
  if (state !== 'active') return;
  resumeCloudSync();
}

export function onCloudNetworkOffline(): void {
  cloudSyncEngine.markOffline();
}

export function onCloudNetworkOnline(): void {
  resumeCloudSync();
}

/** Any available link can resume pending work, including mobile data. */
export function onSyncTransportChange(transport: SyncTransport): void {
  if (transport === 'offline') { cloudSyncEngine.markOffline(); return; }
  resumeCloudSync();
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
    onlineTarget.call(globalThis, 'offline', onCloudNetworkOffline);
    cleanups.push(() => {
      offlineRemove?.call(globalThis, 'online', onCloudNetworkOnline);
      offlineRemove?.call(globalThis, 'offline', onCloudNetworkOffline);
    });
  }
  cleanups.push(subscribeSyncTransport(onSyncTransportChange));
  unbind = () => {
    bound = false;
    for (const cleanup of cleanups) cleanup();
    unbind = null;
  };
  return unbind;
}
