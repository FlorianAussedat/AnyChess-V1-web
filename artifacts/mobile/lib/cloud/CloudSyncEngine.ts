import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import {
  activeDocsMatchAccount,
  docsAreEmpty,
  emptySyncableDocs,
  parseWorkspace,
  quarantineLegacyGuest,
  readSyncableDocs,
  workspaceEnvelope,
  writeSyncableDocs,
} from './accountSpace.ts';
import { rememberBackup } from './backupIndex.ts';
import { markConfirmationEmailSent, confirmationResendWaitSeconds } from './confirmCooldown.ts';
import { applyDevicePreferences, captureDevicePreferences } from './devicePreferences.ts';
import { mergeDocumentPayload } from './mergeDocuments.ts';
import { clearDeletionPending, purgeAccountOwnedKeys } from './purgeAccountLocal.ts';
import {
  CLOUD_ACTIVE_USER_KEY,
  CLOUD_LAST_BACKUP_KEY,
  CLOUD_SESSION_KEY,
  GUEST_OWNER_ID,
  SYNCABLE_STORAGE_KEYS,
  cloudBackupKey,
  cloudWorkspaceKey,
} from './syncableKeys.ts';
import { decideCloudTransfer } from './syncTransport.ts';
import type {
  CloudAuth,
  CloudRemote,
  CloudSyncStatus,
  CloudUser,
  PendingConfirmationReason,
} from './types.ts';

export type CloudEngineState = {
  status: CloudSyncStatus;
  user: CloudUser | null;
  lastError: string | null;
  lastBackupKey: string | null;
  lastSyncedAt: string | null;
  pendingConfirmationEmail: string | null;
  pendingConfirmationReason: PendingConfirmationReason | null;
  /** False until the saved session has been read. Avoids flashing the guest screen. */
  sessionReady: boolean;
};

const emptyState = (): CloudEngineState => ({
  status: 'signed_out',
  user: null,
  lastError: null,
  lastBackupKey: null,
  lastSyncedAt: null,
  pendingConfirmationEmail: null,
  pendingConfirmationReason: null,
  sessionReady: false,
});

async function readDocs(storage: KeyValueStorage): Promise<Record<string, string | null>> {
  return readSyncableDocs(storage);
}

async function writeDocs(
  storage: KeyValueStorage,
  docs: Record<string, string | null>,
): Promise<void> {
  await writeSyncableDocs(storage, docs);
}

export class CloudSyncEngine {
  private state = emptyState();
  private readonly listeners = new Set<() => void>();
  private silentWrites = 0;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private syncing = false;
  private deletionLocked = false;
  /** Bumped on sign-out and account switch so a late sync cannot write the previous account. */
  private sessionEpoch = 0;
  private readonly storage: KeyValueStorage;
  private readonly auth: CloudAuth;
  private readonly remote: CloudRemote;

  constructor(storage: KeyValueStorage, auth: CloudAuth, remote: CloudRemote) {
    this.storage = storage;
    this.auth = auth;
    this.remote = remote;
    if (!auth.configured) {
      this.state.status = 'unconfigured';
      this.state.sessionReady = true;
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getState(): CloudEngineState {
    return { ...this.state };
  }

  /** User access token only — never the public anon key. */
  getAccessToken(): string | null {
    const token = this.auth.token?.();
    return token?.trim() || null;
  }

  storageHandle(): KeyValueStorage {
    return this.storage;
  }

  isAccountDeletionLocked(): boolean {
    return this.deletionLocked;
  }

  beginAccountDeletion(): void {
    this.deletionLocked = true;
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
  }

  releaseAccountDeletion(): void {
    this.deletionLocked = false;
  }

  private bumpSession(): number {
    this.sessionEpoch += 1;
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    return this.sessionEpoch;
  }

  private sessionIsCurrent(epoch: number): boolean {
    return this.sessionEpoch === epoch && !this.deletionLocked;
  }

  /**
   * Local tokens are cleared by auth.signOut before any network call.
   * A stuck logout request must not keep the account on screen.
   */
  private endAuthSession(): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(finish, 800);
      void this.auth.signOut().then(finish, finish);
    });
  }

  async readRefreshToken(): Promise<string | null> {
    const raw = await this.storage.getItem(CLOUD_SESSION_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as { refreshToken?: string };
      return parsed.refreshToken?.trim() || null;
    } catch {
      return null;
    }
  }

  /** Drop this account's parked copies, then put the guest workspace back if it was active. */
  async wipeDeletedAccount(userId: string): Promise<void> {
    const active =
      this.state.user?.id ?? (await this.storage.getItem(CLOUD_ACTIVE_USER_KEY));
    await purgeAccountOwnedKeys(this.storage, userId);
    await clearDeletionPending(this.storage);
    if (active !== userId) {
      this.deletionLocked = false;
      return;
    }
    await this.auth.signOut();
    await this.storage.removeItem(CLOUD_SESSION_KEY);
    await this.restoreWorkspace(GUEST_OWNER_ID);
    await this.withSilentWrites(async () => {
      await this.mirrorPreferences();
      await this.mirrorProfile();
    });
    await this.storage.setItem(CLOUD_ACTIVE_USER_KEY, GUEST_OWNER_ID);
    this.deletionLocked = false;
    this.setState({
      user: null,
      status: this.auth.configured ? 'signed_out' : 'unconfigured',
      pendingConfirmationEmail: null,
      pendingConfirmationReason: null,
      lastError: null,
      sessionReady: true,
    });
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
      const ownerId =
        this.state.user?.id ??
        (await this.storage.getItem(CLOUD_ACTIVE_USER_KEY)) ??
        GUEST_OWNER_ID;
      await this.storage.setItem(
        key,
        JSON.stringify({ version: 2, ownerId, createdAt: new Date().toISOString(), docs }),
      );
      await rememberBackup(this.storage, key, ownerId);
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
        JSON.stringify(workspaceEnvelope(ownerId, docs)),
      );
    });
  }

  async restoreWorkspace(ownerId: string): Promise<boolean> {
    return this.withSilentWrites(async () => {
      const raw = await this.storage.getItem(cloudWorkspaceKey(ownerId));
      const parsed = parseWorkspace(raw, ownerId);
      if (!parsed) {
        await writeDocs(this.storage, emptySyncableDocs());
        return false;
      }
      await writeDocs(this.storage, parsed.docs);
      return true;
    });
  }

  /** Guest files exist only when they were saved as guest, never as a copy of an account. */
  async guestDataAvailable(): Promise<boolean> {
    const parsed = parseWorkspace(
      await this.storage.getItem(cloudWorkspaceKey(GUEST_OWNER_ID)),
      GUEST_OWNER_ID,
    );
    return Boolean(parsed && parsed.origin === 'guest' && !docsAreEmpty(parsed.docs));
  }

  /**
   * Copy the guest space into the signed-in account. Does not run on sign-in.
   * The guest copy stays on the device.
   */
  async importGuestData(): Promise<{ ok: true } | { ok: false; error: 'signed_out' | 'no_guest' }> {
    const user = this.state.user;
    if (!user) return { ok: false, error: 'signed_out' };
    if (!(await this.guestDataAvailable())) return { ok: false, error: 'no_guest' };
    const guest = parseWorkspace(
      await this.storage.getItem(cloudWorkspaceKey(GUEST_OWNER_ID)),
      GUEST_OWNER_ID,
    );
    if (!guest) return { ok: false, error: 'no_guest' };
    const local = await readDocs(this.storage);
    const merged: Record<string, string | null> = {};
    for (const key of SYNCABLE_STORAGE_KEYS) {
      merged[key] = mergeDocumentPayload(key, local[key] ?? null, guest.docs[key] ?? null);
    }
    await this.withSilentWrites(async () => {
      await writeDocs(this.storage, merged);
      await this.mirrorPreferences();
      await this.mirrorProfile();
    });
    await this.parkWorkspace(user.id);
    await this.sync();
    return { ok: true };
  }

  private async activeOwnerId(): Promise<string> {
    return (await this.storage.getItem(CLOUD_ACTIVE_USER_KEY)) ?? GUEST_OWNER_ID;
  }

  /** Save whoever currently owns the active documents, without copying an account into guest. */
  private async parkCurrentOwner(): Promise<void> {
    await captureDevicePreferences(this.storage);
    const owner = this.state.user?.id ?? (await this.activeOwnerId());
    if (owner === GUEST_OWNER_ID) {
      await quarantineLegacyGuest(this.storage);
      if (await activeDocsMatchAccount(this.storage)) {
        await writeDocs(this.storage, emptySyncableDocs());
        return;
      }
    }
    await this.parkWorkspace(owner);
  }

  private async showOwner(ownerId: string): Promise<boolean> {
    const had = await this.restoreWorkspace(ownerId);
    await this.storage.setItem(CLOUD_ACTIVE_USER_KEY, ownerId);
    if (ownerId === GUEST_OWNER_ID) await quarantineLegacyGuest(this.storage);
    await applyDevicePreferences(this.storage);
    await this.withSilentWrites(async () => {
      await this.mirrorPreferences();
      await this.mirrorProfile();
    });
    await this.invalidateDeferredWork();
    return had;
  }

  private async invalidateDeferredWork(): Promise<void> {
    try {
      const { pgnTranslationQueue } = await import('../pgnComments/PgnTranslationQueue.ts');
      if (pgnTranslationQueue.matchesStorage(this.storage)) pgnTranslationQueue.invalidateSession();
    } catch {
      // Translation work is also stored in the account workspace.
    }
  }

  /** Pull merged preferences into the in-memory store when it uses this storage. */
  private async mirrorPreferences(): Promise<void> {
    try {
      const { preferencesStore } = await import('../preferences/PreferencesStore.ts');
      if (!preferencesStore.usesStorage(this.storage)) return;
      await preferencesStore.reloadFromStorage();
    } catch {
      // The stored document is already updated. The next launch reads it.
    }
  }

  private async mirrorProfile(): Promise<void> {
    try {
      const { profileStore } = await import('../profile/ProfileStore.ts');
      if (!profileStore.usesStorage(this.storage)) return;
      await profileStore.reloadFromStorage();
    } catch {
      // The stored document is already updated. The next launch reads it.
    }
  }

  private async settleAccountLifecycle(): Promise<void> {
    if (this.deletionLocked) return;
    try {
      const { settleAccountLifecycle } = await import('./accountLifecycle.ts');
      await settleAccountLifecycle(this);
    } catch {
      // Avatar upload and deletion resume must not block the session.
    }
  }

  async hydrate(): Promise<CloudEngineState> {
    try {
      if (!this.auth.configured) {
        this.setState({ status: 'unconfigured', user: null });
      } else {
        if (this.auth.hydrate) await this.auth.hydrate();
        const user = await this.auth.getUser();
        const backup = await this.storage.getItem(CLOUD_LAST_BACKUP_KEY);
        if (!user) {
          this.setState({ status: 'signed_out', user: null, lastBackupKey: backup });
          await quarantineLegacyGuest(this.storage);
        } else {
          const active = await this.activeOwnerId();
          if (active !== user.id && active !== GUEST_OWNER_ID) {
            await this.parkWorkspace(active);
            await this.showOwner(user.id);
          } else {
            await this.storage.setItem(CLOUD_ACTIVE_USER_KEY, user.id);
          }
          this.setState({ user, lastBackupKey: backup, status: 'pending' });
          await this.sync();
          await this.settleAccountLifecycle();
        }
      }
    } catch (error) {
      if (this.state.user) {
        const offline = error instanceof Error && /network|fetch|offline/i.test(error.message);
        this.setState({
          status: offline ? 'offline' : 'error',
          lastError: error instanceof Error ? error.message : 'sync_failed',
        });
      }
    } finally {
      if (!this.state.sessionReady) this.setState({ sessionReady: true });
    }
    return this.getState();
  }

  async signUp(email: string, password: string) {
    return this.authenticate(email, () => this.auth.signUp(email, password), 'signup');
  }

  async signIn(email: string, password: string) {
    return this.authenticate(email, () => this.auth.signIn(email, password), 'signin');
  }

  async resendSignupConfirmation(email: string) {
    if (!this.auth.configured) return { ok: false as const, error: 'unconfigured' as const };
    if (confirmationResendWaitSeconds() > 0) {
      return { ok: false as const, error: 'rate_limited' as const };
    }
    const result = await this.auth.resendSignupConfirmation(email);
    if (result.ok) markConfirmationEmailSent();
    return result;
  }

  dismissPendingConfirmation(): void {
    this.setState({ pendingConfirmationEmail: null, pendingConfirmationReason: null });
  }

  async recoverPassword(email: string) {
    return this.auth.recoverPassword(email);
  }

  async signOut(): Promise<{ ok: true } | { ok: false; error: 'unexpected' }> {
    const epoch = this.bumpSession();
    try {
      await this.parkCurrentOwner();
    } catch {
      if (!this.sessionIsCurrent(epoch)) return { ok: true };
      this.setState({ lastError: 'sign_out_failed', sessionReady: true });
      return { ok: false, error: 'unexpected' };
    }
    const signedOut = {
      user: null,
      status: this.auth.configured ? ('signed_out' as const) : ('unconfigured' as const),
      pendingConfirmationEmail: null,
      pendingConfirmationReason: null,
      sessionReady: true,
    };
    try {
      await this.endAuthSession();
      if (!this.sessionIsCurrent(epoch)) return { ok: true };
      await this.storage.removeItem(CLOUD_SESSION_KEY);
      await this.showOwner(GUEST_OWNER_ID);
    } catch {
      if (!this.sessionIsCurrent(epoch)) return { ok: true };
      await this.storage.removeItem(CLOUD_SESSION_KEY).catch(() => undefined);
      await this.showOwner(GUEST_OWNER_ID).catch(async () => {
        await this.withSilentWrites(() => writeDocs(this.storage, emptySyncableDocs()));
        await this.storage.setItem(CLOUD_ACTIVE_USER_KEY, GUEST_OWNER_ID);
      });
      this.setState({ ...signedOut, lastError: 'sign_out_failed' });
      return { ok: false, error: 'unexpected' };
    }
    if (!this.sessionIsCurrent(epoch)) return { ok: true };
    this.setState({ ...signedOut, lastError: null });
    return { ok: true };
  }

  /** Memory auth has no access token. Supabase must not sync on the anon key. */
  private hasAuthenticatedSession(): boolean {
    if (typeof this.auth.token !== 'function') return true;
    return Boolean(this.auth.token()?.trim());
  }

  private async authenticate(
    email: string,
    action: () => ReturnType<CloudAuth['signIn']>,
    source: 'signup' | 'signin',
  ) {
    if (!this.auth.configured) {
      this.setState({ status: 'unconfigured' });
      return { ok: false as const, error: 'unconfigured' as const };
    }
    const epoch = this.bumpSession();
    await this.backupLocal();
    if (!this.sessionIsCurrent(epoch)) {
      return { ok: false as const, error: 'unexpected' as const };
    }
    await this.parkCurrentOwner();
    const result = await action();
    if (!this.sessionIsCurrent(epoch)) {
      return result.ok ? { ok: false as const, error: 'unexpected' as const } : result;
    }
    const needsConfirm =
      !result.ok && (result.error === 'confirm_email' || result.error === 'email_not_confirmed');
    if (!result.ok) {
      if (result.error === 'confirm_email') markConfirmationEmailSent();
      this.setState({
        status: this.auth.configured ? 'signed_out' : 'unconfigured',
        user: null,
        lastError: null,
        pendingConfirmationEmail: needsConfirm ? email.trim() : null,
        pendingConfirmationReason: needsConfirm ? source : null,
        sessionReady: true,
      });
      return result;
    }
    if (!this.hasAuthenticatedSession()) {
      markConfirmationEmailSent();
      this.setState({
        status: 'signed_out',
        user: null,
        lastError: null,
        pendingConfirmationEmail: email.trim(),
        pendingConfirmationReason: 'signup',
        sessionReady: true,
      });
      return { ok: false as const, error: 'confirm_email' as const, email: email.trim() };
    }
    await this.showOwner(result.user.id);
    if (!this.sessionIsCurrent(epoch)) {
      return { ok: false as const, error: 'unexpected' as const };
    }
    this.setState({
      user: result.user,
      status: 'pending',
      lastError: null,
      pendingConfirmationEmail: null,
      pendingConfirmationReason: null,
      sessionReady: true,
    });
    await this.sync();
    await this.settleAccountLifecycle();
    return result;
  }

  markWaitingForWifi(): void {
    if (this.deletionLocked || !this.state.user) return;
    this.setState({ status: 'waiting_wifi', lastError: null });
  }

  async sync(options?: { allowCellular?: boolean }): Promise<CloudEngineState> {
    if (this.deletionLocked) return this.getState();
    const epoch = this.sessionEpoch;
    if (typeof this.auth.token === 'function' && !this.auth.token()?.trim()) {
      this.setState({
        status: this.auth.configured ? 'signed_out' : 'unconfigured',
        user: null,
        lastError: null,
      });
      return this.getState();
    }
    const user = this.state.user ?? (await this.auth.getUser());
    if (!this.auth.configured) {
      this.setState({ status: 'unconfigured' });
      return this.getState();
    }
    if (!user) {
      this.setState({ status: 'signed_out', user: null });
      return this.getState();
    }
    const ownerId = user.id;
    const stale = () =>
      !this.sessionIsCurrent(epoch) || (this.state.user != null && this.state.user.id !== ownerId);
    const decision = await decideCloudTransfer(options?.allowCellular === true);
    if (stale()) return this.getState();
    if (decision.defer) {
      this.setState({ user, status: 'waiting_wifi', lastError: null });
      return this.getState();
    }
    if (decision.offline) {
      this.setState({ user, status: 'offline', lastError: null });
      return this.getState();
    }
    this.setState({ user, status: 'pending', lastError: null });
    this.syncing = true;
    try {
      const remoteDocs = await this.remote.listDocuments(user.id);
      if (stale()) return this.getState();
      const remoteMap = new Map(remoteDocs.map((doc) => [doc.docKey, doc]));
      const localDocs = await readDocs(this.storage);
      const merged: Record<string, string | null> = { ...localDocs };
      for (const key of SYNCABLE_STORAGE_KEYS) {
        if (stale()) return this.getState();
        const local = localDocs[key] ?? null;
        const remote = remoteMap.get(key)?.payload ?? null;
        const next = mergeDocumentPayload(key, local, remote);
        merged[key] = next;
        if (next == null) continue;
        const sessionUser = await this.auth.getUser();
        if (stale() || !sessionUser || sessionUser.id !== ownerId) return this.getState();
        await this.remote.upsertDocument(ownerId, {
          docKey: key,
          payload: next,
          updatedAt: new Date().toISOString(),
          deletedAt: null,
          revision: (remoteMap.get(key)?.revision ?? 0) + 1,
        });
      }
      if (stale()) return this.getState();
      await this.withSilentWrites(async () => {
        await writeDocs(this.storage, merged);
        await this.mirrorPreferences();
        await this.mirrorProfile();
      });
      if (stale()) return this.getState();
      this.setState({
        status: 'synced',
        lastSyncedAt: new Date().toISOString(),
        lastError: null,
      });
      await this.settleAccountLifecycle();
    } catch (error) {
      if (stale()) return this.getState();
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
    if (this.deletionLocked) return;
    if (this.state.user && this.state.status !== 'unconfigured') {
      this.setState({ status: 'pending' });
    }
  }

  notifyLocalMutation(): void {
    if (this.deletionLocked || this.silentWrites > 0 || this.syncing || !this.state.user) return;
    void this.queueLocalMutation();
  }

  private async queueLocalMutation(): Promise<void> {
    const decision = await decideCloudTransfer(false);
    if (!this.state.user || this.deletionLocked || this.syncing) return;
    if (decision.defer) {
      this.setState({ status: 'waiting_wifi', lastError: null });
      return;
    }
    if (decision.offline) {
      this.setState({ status: 'offline', lastError: null });
      return;
    }
    this.markPending();
    this.scheduleSync();
  }

  scheduleSync(delayMs = 800): void {
    if (this.deletionLocked) return;
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
