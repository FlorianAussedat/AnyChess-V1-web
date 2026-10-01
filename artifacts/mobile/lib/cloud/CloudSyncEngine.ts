import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import { mergeDocumentPayload } from './mergeDocuments.ts';
import {
  CLOUD_ACTIVE_USER_KEY,
  CLOUD_LAST_BACKUP_KEY,
  CLOUD_SESSION_KEY,
  GUEST_OWNER_ID,
  SYNCABLE_STORAGE_KEYS,
  cloudBackupKey,
  cloudWorkspaceKey,
} from './syncableKeys.ts';
import type { CloudAuth, CloudRemote, CloudSyncStatus, CloudUser } from './types.ts';

export type CloudEngineState = {
  status: CloudSyncStatus;
  user: CloudUser | null;
  lastError: string | null;
  lastBackupKey: string | null;
  lastSyncedAt: string | null;
};

const emptyState = (): CloudEngineState => ({
  status: 'signed_out',
  user: null,
  lastError: null,
  lastBackupKey: null,
  lastSyncedAt: null,
});

async function readDocs(storage: KeyValueStorage): Promise<Record<string, string | null>> {
  const docs: Record<string, string | null> = {};
  for (const key of SYNCABLE_STORAGE_KEYS) {
    docs[key] = await storage.getItem(key);
  }
  return docs;
}

async function writeDocs(
  storage: KeyValueStorage,
  docs: Record<string, string | null>,
): Promise<void> {
  for (const key of SYNCABLE_STORAGE_KEYS) {
    const value = docs[key];
    if (value == null) await storage.removeItem(key);
    else await storage.setItem(key, value);
  }
}

export class CloudSyncEngine {
  private state = emptyState();
  private readonly listeners = new Set<() => void>();
  private silentWrites = 0;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private syncing = false;
  private readonly storage: KeyValueStorage;
  private readonly auth: CloudAuth;
  private readonly remote: CloudRemote;

  constructor(storage: KeyValueStorage, auth: CloudAuth, remote: CloudRemote) {
    this.storage = storage;
    this.auth = auth;
    this.remote = remote;
    if (!auth.configured) this.state.status = 'unconfigured';
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getState(): CloudEngineState {
    return { ...this.state };
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private setState(patch: Partial<CloudEngineState>): void {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  private async withSilentWrites<T>(fn: () => Promise<T>): Promise<T> {
    this.silentWrites += 1;
    try {
      return await fn();
    } finally {
      this.silentWrites -= 1;
    }
  }

  async backupLocal(): Promise<string> {
    return this.withSilentWrites(async () => {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const key = cloudBackupKey(stamp);
      const docs = await readDocs(this.storage);
      await this.storage.setItem(
        key,
        JSON.stringify({ version: 1, createdAt: new Date().toISOString(), docs }),
      );
      await this.storage.setItem(CLOUD_LAST_BACKUP_KEY, key);
      this.setState({ lastBackupKey: key });
      return key;
    });
  }

  async parkWorkspace(ownerId: string): Promise<void> {
    await this.withSilentWrites(async () => {
      const docs = await readDocs(this.storage);
      await this.storage.setItem(
        cloudWorkspaceKey(ownerId),
        JSON.stringify({ ownerId, docs, parkedAt: new Date().toISOString() }),
      );
    });
  }

  async restoreWorkspace(ownerId: string): Promise<boolean> {
    return this.withSilentWrites(async () => {
      const raw = await this.storage.getItem(cloudWorkspaceKey(ownerId));
      if (!raw) {
        await writeDocs(this.storage, Object.fromEntries(SYNCABLE_STORAGE_KEYS.map((key) => [key, null])));
        return false;
      }
      const parsed = JSON.parse(raw) as { docs?: Record<string, string | null> };
      await writeDocs(this.storage, parsed.docs ?? {});
      return true;
    });
  }

  async hydrate(): Promise<CloudEngineState> {
    if (!this.auth.configured) {
      this.setState({ status: 'unconfigured', user: null });
      return this.getState();
    }
    if (this.auth.hydrate) await this.auth.hydrate();
    const user = await this.auth.getUser();
    const backup = await this.storage.getItem(CLOUD_LAST_BACKUP_KEY);
    if (!user) {
      this.setState({ status: 'signed_out', user: null, lastBackupKey: backup });
      return this.getState();
    }
    this.setState({ user, lastBackupKey: backup, status: 'pending' });
    await this.sync();
    return this.getState();
  }

  async signUp(email: string, password: string) {
    return this.authenticate(() => this.auth.signUp(email, password));
  }

  async signIn(email: string, password: string) {
    return this.authenticate(() => this.auth.signIn(email, password));
  }

  async recoverPassword(email: string) {
    return this.auth.recoverPassword(email);
  }

  async signOut(): Promise<void> {
    const current = this.state.user?.id ?? (await this.storage.getItem(CLOUD_ACTIVE_USER_KEY));
    if (current && current !== GUEST_OWNER_ID) {
      await this.parkWorkspace(current);
    }
    await this.auth.signOut();
    await this.storage.removeItem(CLOUD_SESSION_KEY);
    await this.restoreWorkspace(GUEST_OWNER_ID);
    await this.storage.setItem(CLOUD_ACTIVE_USER_KEY, GUEST_OWNER_ID);
    this.setState({ user: null, status: this.auth.configured ? 'signed_out' : 'unconfigured' });
  }

  private async authenticate(action: () => ReturnType<CloudAuth['signIn']>) {
    if (!this.auth.configured) {
      this.setState({ status: 'unconfigured' });
      return { ok: false as const, error: 'unconfigured' as const };
    }
    await this.backupLocal();
    const previous =
      (await this.storage.getItem(CLOUD_ACTIVE_USER_KEY)) ?? GUEST_OWNER_ID;
    await this.parkWorkspace(previous);
    const result = await action();
    if (!result.ok) {
      this.setState({ status: 'error', lastError: result.error });
      return result;
    }
    await this.storage.setItem(CLOUD_ACTIVE_USER_KEY, result.user.id);
    const hadWorkspace = await this.restoreWorkspace(result.user.id);
    if (!hadWorkspace && previous === GUEST_OWNER_ID) {
      await this.restoreWorkspace(GUEST_OWNER_ID);
    } else if (!hadWorkspace) {
      await this.withSilentWrites(() =>
        writeDocs(
          this.storage,
          Object.fromEntries(SYNCABLE_STORAGE_KEYS.map((key) => [key, null])),
        ),
      );
    }
    this.setState({ user: result.user, status: 'pending' });
    await this.sync();
    return result;
  }

  async sync(): Promise<CloudEngineState> {
    const user = this.state.user ?? (await this.auth.getUser());
    if (!this.auth.configured) {
      this.setState({ status: 'unconfigured' });
      return this.getState();
    }
    if (!user) {
      this.setState({ status: 'signed_out', user: null });
      return this.getState();
    }
    this.setState({ user, status: 'pending', lastError: null });
    this.syncing = true;
    try {
      const remoteDocs = await this.remote.listDocuments(user.id);
      const remoteMap = new Map(remoteDocs.map((doc) => [doc.docKey, doc]));
      const localDocs = await readDocs(this.storage);
      const merged: Record<string, string | null> = { ...localDocs };
      for (const key of SYNCABLE_STORAGE_KEYS) {
        const local = localDocs[key] ?? null;
        const remote = remoteMap.get(key)?.payload ?? null;
        const next = mergeDocumentPayload(key, local, remote);
        merged[key] = next;
        if (next != null) {
          await this.remote.upsertDocument(user.id, {
            docKey: key,
            payload: next,
            updatedAt: new Date().toISOString(),
            deletedAt: null,
            revision: (remoteMap.get(key)?.revision ?? 0) + 1,
          });
        }
      }
      await this.withSilentWrites(() => writeDocs(this.storage, merged));
      this.setState({
        status: 'synced',
        lastSyncedAt: new Date().toISOString(),
        lastError: null,
      });
    } catch (error) {
      const offline = error instanceof Error && /network|fetch|offline/i.test(error.message);
      this.setState({
        status: offline ? 'offline' : 'error',
        lastError: error instanceof Error ? error.message : 'sync_failed',
      });
    } finally {
      this.syncing = false;
    }
    return this.getState();
  }

  markPending(): void {
    if (this.state.user && this.state.status !== 'unconfigured') {
      this.setState({ status: 'pending' });
    }
  }

  notifyLocalMutation(): void {
    if (this.silentWrites > 0 || this.syncing || !this.state.user) return;
    this.markPending();
    this.scheduleSync();
  }

  scheduleSync(delayMs = 800): void {
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => {
      this.syncTimer = null;
      void this.sync();
    }, delayMs);
  }
}

export async function restoreBackup(
  storage: KeyValueStorage,
  backupKey: string,
): Promise<boolean> {
  const raw = await storage.getItem(backupKey);
  if (!raw) return false;
  const parsed = JSON.parse(raw) as { docs?: Record<string, string | null> };
  if (!parsed.docs) return false;
  await writeDocs(storage, parsed.docs);
  return true;
}
