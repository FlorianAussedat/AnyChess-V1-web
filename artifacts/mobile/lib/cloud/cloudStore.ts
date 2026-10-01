import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import {
  defaultKeyValueStorage,
  subscribeKeyValueWrites,
} from '../storage/AsyncKeyValueStorage.ts';
import { CloudSyncEngine } from './CloudSyncEngine.ts';
import { MemoryCloudAuth, MemoryCloudRemote } from './MemoryCloud.ts';
import { SupabaseCloudAuth, SupabaseCloudRemote } from './SupabaseCloud.ts';
import { isSupabaseConfigured } from './supabaseConfig.ts';
import { CLOUD_SESSION_KEY, isSyncableStorageKey } from './syncableKeys.ts';
import type { CloudAuth, CloudRemote, CloudSession } from './types.ts';

class UnconfiguredAuth implements CloudAuth {
  readonly configured = false;
  async getUser() {
    return null;
  }
  async signUp() {
    return { ok: false as const, error: 'unconfigured' as const };
  }
  async signIn() {
    return { ok: false as const, error: 'unconfigured' as const };
  }
  async signOut() {}
  async recoverPassword() {
    return { ok: false, error: 'unconfigured' as const };
  }
}

export function createCloudEngine(
  storage: KeyValueStorage = defaultKeyValueStorage,
  deps?: { auth?: CloudAuth; remote?: CloudRemote },
): CloudSyncEngine {
  if (deps?.auth && deps.remote) {
    return new CloudSyncEngine(storage, deps.auth, deps.remote);
  }
  if (isSupabaseConfigured()) {
    const auth = new SupabaseCloudAuth({
      async load() {
        const raw = await storage.getItem(CLOUD_SESSION_KEY);
        if (!raw) return null;
        try {
          return JSON.parse(raw) as CloudSession;
        } catch {
          return null;
        }
      },
      async save(session) {
        if (!session) await storage.removeItem(CLOUD_SESSION_KEY);
        else await storage.setItem(CLOUD_SESSION_KEY, JSON.stringify(session));
      },
    });
    return new CloudSyncEngine(storage, auth, new SupabaseCloudRemote(auth));
  }
  return new CloudSyncEngine(storage, new UnconfiguredAuth(), new MemoryCloudRemote());
}

export const cloudSyncEngine = createCloudEngine();

subscribeKeyValueWrites((key) => {
  if (isSyncableStorageKey(key)) cloudSyncEngine.notifyLocalMutation();
});

export async function hydrateCloudSession(): Promise<void> {
  if (isSupabaseConfigured() && cloudSyncEngine.getState().status === 'unconfigured') {
    // Engine was created before env was available in some tests; hydrate still reports unconfigured.
  }
  await cloudSyncEngine.hydrate();
}
