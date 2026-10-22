import { verifiedBackup } from './verifiedBackup.ts';
import { cloudStep, reportCloudError, type CloudErrorKind } from './diagnostics.ts';
import { setAuthDraftEmail } from './authDraft.ts';
import { readDeletionPending } from './purgeAccountLocal.ts';
import { authRequest } from './authRequest.ts';
import { applySignupProfile } from './signupProfile.ts';
import { validAuthEmail } from './authRequest.ts';
import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import { StorageKeys } from '../storage/StorageKeys.ts';
import { defaultKeyValueStorage } from '../storage/AsyncKeyValueStorage.ts';
import {
  activeDocsMatchAccount,
  docsAreEmpty,
  emptySyncableDocs,
  parseWorkspace,
  quarantineLegacyGuest,
  readSyncableDocs,
  workspaceEnvelope,
  docsEqual,
  writeSyncableDocs,
} from './accountSpace.ts';
import { rememberBackup } from './backupIndex.ts';
import { markConfirmationEmailSent, confirmationResendWaitSeconds } from './confirmCooldown.ts';
import { applyDevicePreferences, captureDevicePreferences } from './devicePreferences.ts';
import { mergeDocumentPayload } from './mergeDocuments.ts';
import { clearDeletionPending, purgeAccountOwnedKeys } from './purgeAccountLocal.ts';
import {
  GUEST_PGN_VAULT_KEY,
  guestVaultHasStudies,
  presentEmptyGuestLibrary,
  preserveGuestRepertoire,
  repertoireFileIds,
  repertoirePayloadCovers,
  writePgnPresenceAudit,
} from './guestPgnVault.ts';
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
  CloudAuthResult,
  AuthAttemptOptions,
  CloudRemote,
  CloudSyncStatus,
  CloudUser,
  PendingConfirmationReason,
} from './types.ts';

export type CloudEngineState = {
  quotaPaused?: boolean;
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
  private readonly failedLocalKeys = new Set<string>();
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private syncing = false;
  private authFlight: Promise<CloudAuthResult> | null = null;
  private authFlightEpoch = 0;
  private authFlightKey = '';
  private authAbandoned?: () => boolean;
  private syncFlight: Promise<CloudEngineState> | null = null;
  private retryAttempt = 0;
  private quotaBlocked = false;
  private disposed = false;
  private flightEpoch = 0;
  private deletionLocked = false;
  /** Bumped on sign-out and account switch so a late sync cannot write the previous account. */
  private sessionEpoch = 0;
  /** Bumped on each local change so an in-flight sync can re-read before it writes. */
  private mutationEpoch = 0;
  private followUpSync = false;
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

  /** End an engine lifetime without signing out or changing persistent documents. */
  dispose():void {
    this.disposed=true;
    this.bumpSession();
    this.listeners.clear();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getState(): CloudEngineState {
    return { ...this.state, quotaPaused: this.quotaBlocked };
  }

  /** User access token only — never the public anon key. */
  getAccessToken(): string | null {
    const token = this.auth.token?.();
    return token?.trim() || null;
  }

  sessionGuard(): () => boolean {
    const epoch = this.sessionEpoch;
    return () => this.sessionEpoch === epoch;
  }

  storageHandle(): KeyValueStorage {
    return this.storage;
  }

  isAccountDeletionLocked(): boolean {
    return this.deletionLocked;
  }

  beginAccountDeletion(): void {
    this.deletionLocked = true;
    this.bumpSession();
    if (this.state.user) this.setState({ status: 'pending' });
  }

  async quiesceForAccountDeletion(): Promise<void> {
    const inFlight = this.syncFlight;
    this.beginAccountDeletion();
    if (inFlight) await authRequest(() => inFlight);
  }

  noteDeletionUncertain(): void {
    if (this.state.user) this.setState({ status: 'error', lastError: 'deletion_pending' });
  }

  releaseAccountDeletion(): void {
    this.deletionLocked = false;
  }

  private bumpSession(): number {
    this.quotaBlocked=false;
    this.sessionEpoch += 1;
    this.failedLocalKeys.clear();
    this.retryAttempt = 0;
    this.followUpSync = false;
    this.syncFlight = null;
    this.syncing = false;
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    return this.sessionEpoch;
  }

  private sessionIsCurrent(epoch: number): boolean {
    return this.sessionEpoch === epoch && !this.deletionLocked && !this.disposed;
  }

  /**
   * Local tokens are cleared by auth.signOut before any network call.
   * A stuck logout request must not keep the account on screen.
   */
  private endAuthSession(): Promise<void> {
    if (this.auth.localSignOutOnly) return this.auth.signOut();
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

  async probeAuthAccount(): Promise<'exists' | 'gone' | 'unknown'> {
    return this.auth.probeAccount?.() ?? 'unknown';
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
    await purgeAccountOwnedKeys(this.storage, userId, this.state.user?.id === userId ? this.state.user.email : undefined);
    await clearDeletionPending(this.storage);
    if (active !== userId) {
      this.deletionLocked = false;
      return;
    }
    await this.auth.signOut();
    await this.storage.removeItem(CLOUD_SESSION_KEY);
    await this.restoreWorkspace(GUEST_OWNER_ID);
    await this.withSilentWrites(async () => {
      await cloudStep('workspace.mirror_preferences', 'local', () => this.mirrorPreferences());
      await cloudStep('workspace.mirror_profile', 'local', () => this.mirrorProfile());
    });
    await this.storage.setItem(CLOUD_ACTIVE_USER_KEY, GUEST_OWNER_ID);
    this.deletionLocked = false;
    this.setState({
      user: null,
      lastSyncedAt: null,
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
    if(patch.lastError==='local_quota') this.quotaBlocked=true;
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  private async withSilentWrites<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }

  async backupLocal(recordLast = true): Promise<string> {
    return this.withSilentWrites(async () => {
      const epoch = this.sessionEpoch;
      const ownerId = this.state.user?.id ?? (await this.storage.getItem(CLOUD_ACTIVE_USER_KEY)) ?? GUEST_OWNER_ID;
      const docs = await cloudStep('snapshot.read_documents', 'local', () => readDocs(this.storage));
      if (epoch !== this.sessionEpoch) throw new Error('backup_owner_changed');
      const key = await cloudStep('backup.verify_or_create','local',()=>verifiedBackup(this.storage,ownerId,docs));
      if (epoch !== this.sessionEpoch) throw new Error('backup_owner_changed');
      if (recordLast) {
        await this.storage.setItem(CLOUD_LAST_BACKUP_KEY, key);
        this.setState({ lastBackupKey: key });
      }
      return key;
    });
  }

  async parkWorkspace(ownerId: string): Promise<void> {
    const mutation = this.mutationEpoch;
    await this.withSilentWrites(async () => {
      const docs = await cloudStep('snapshot.read_documents', 'local', () => readDocs(this.storage));
      if (ownerId === GUEST_OWNER_ID) {
        const matchesAccount = await activeDocsMatchAccount(this.storage);
        const preserved = await preserveGuestRepertoire(
          this.storage,
          matchesAccount ? null : (docs[StorageKeys.repertoires.key] ?? null),
        );
        if (preserved) docs[StorageKeys.repertoires.key] = preserved;
        else if (matchesAccount) {
          docs[StorageKeys.repertoires.key] = await this.storage.getItem(GUEST_PGN_VAULT_KEY);
        }
      }
      const key = cloudWorkspaceKey(ownerId);
      const existing = await cloudStep('workspace.read_previous','local',async()=>{
        try { return await this.storage.getItem(key); } catch(error) {
          if(reportCloudError('workspace.read_previous','local',error).kind==='local_size_limit')return null;
          throw error;
        }
      });
      const previous = parseWorkspace(existing,ownerId);
      const payload = previous && docsEqual(previous.docs,docs) ? existing! : JSON.stringify({ownerId,origin:ownerId===GUEST_OWNER_ID?'guest':'account',docs});
      if(payload!==existing) await cloudStep('workspace.write', 'local', () => this.storage.setItem(key, payload));
      await cloudStep('workspace.verify', 'local', async () => {
        if (await this.storage.getItem(key) !== payload) throw new Error('workspace_verify_failed');
        if (mutation !== this.mutationEpoch) throw new Error('workspace_changed_during_park');
      });
    });
  }

  async restoreWorkspace(ownerId: string): Promise<boolean> {
    return this.withSilentWrites(async () => {
      const raw = await cloudStep('workspace.restore.read', 'local', () => this.storage.getItem(cloudWorkspaceKey(ownerId)));
      const parsed = parseWorkspace(raw, ownerId);
      if (raw && (!parsed || parsed.ownerId !== ownerId)) throw new Error('workspace_invalid');
      if (!parsed) {
        await writeDocs(this.storage, emptySyncableDocs());
        return false;
      }
      await cloudStep('workspace.restore.write_documents', 'local', () => writeDocs(this.storage, parsed.docs));
      return true;
    });
  }

  /** Guest files exist only when they were saved as guest, never as a copy of an account. */
  async guestDataAvailable(): Promise<boolean> {
    if (await guestVaultHasStudies(this.storage)) return true;
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
  async importGuestData(): Promise<
    | { ok: true; remoteVerified: true }
    | { ok: false; error: 'signed_out' | 'no_guest' | 'remote_unverified' }
  > {
    const epoch = this.sessionEpoch;
    const user = this.state.user;
    if (!user) return { ok: false, error: 'signed_out' };
    const stale = () => !this.sessionIsCurrent(epoch) || this.state.user?.id !== user.id;
    if (this.syncFlight) await this.syncFlight;
    if (stale()) return { ok: false, error: 'signed_out' };
    if (!(await this.guestDataAvailable())) return { ok: false, error: 'no_guest' };
    const guest = parseWorkspace(
      await this.storage.getItem(cloudWorkspaceKey(GUEST_OWNER_ID)),
      GUEST_OWNER_ID,
    );
    const vault = await this.storage.getItem(GUEST_PGN_VAULT_KEY);
    const guestDocs: Record<string, string | null> = { ...(guest?.docs ?? {}) };
    if (vault) {
      guestDocs[StorageKeys.repertoires.key] = mergeDocumentPayload(
        StorageKeys.repertoires.key,
        guestDocs[StorageKeys.repertoires.key] ?? null,
        vault,
      );
    }
    if (!guest && !vault) return { ok: false, error: 'no_guest' };
    const vaultIds = repertoireFileIds(guestDocs[StorageKeys.repertoires.key]);
    const auditBase = {
      at: new Date().toISOString(),
      userId: user.id,
      vaultFileIds: vaultIds,
    };
    let remoteDocs;
    try {
      remoteDocs = await this.remote.listDocuments(user.id);
    } catch {
      await writePgnPresenceAudit(this.storage, {
        ...auditBase,
        remoteReachable: false,
        remoteVerified: false,
        remoteFileIds: [],
        note: 'Supabase unreachable. Guest studies were left untouched.',
      });
      return { ok: false, error: 'remote_unverified' };
    }
    if (stale()) return { ok: false, error: 'signed_out' };
    const remoteMap = new Map(remoteDocs.map((doc) => [doc.docKey, doc]));
    await cloudStep('sync.backup', 'local', () => this.backupLocal(false));
    await writePgnPresenceAudit(this.storage, {
      ...auditBase,
      remoteReachable: true,
      remoteVerified: false,
      remoteFileIds: repertoireFileIds(remoteMap.get(StorageKeys.repertoires.key)?.payload),
      note: 'Remote repertoire listed before any guest copy.',
    });
    const local = await readDocs(this.storage);
    const merged: Record<string, string | null> = {};
    for (const key of SYNCABLE_STORAGE_KEYS) {
      merged[key] = mergeDocumentPayload(key, mergeDocumentPayload(key, local[key] ?? null, guestDocs[key] ?? null), remoteMap.get(key)?.payload ?? null);
    }
    if (
      !repertoirePayloadCovers(merged[StorageKeys.repertoires.key], vaultIds)
    ) {
      await writePgnPresenceAudit(this.storage, {
        ...auditBase,
        at: new Date().toISOString(),
        remoteReachable: true,
        remoteVerified: false,
        remoteFileIds: repertoireFileIds(remoteMap.get(StorageKeys.repertoires.key)?.payload),
        note: 'Staged merge would drop a guest study. Nothing was written.',
      });
      return { ok: false, error: 'remote_unverified' };
    }
    try {
      for (const key of SYNCABLE_STORAGE_KEYS) {
        if (stale()) return { ok: false, error: 'signed_out' };
        const next = merged[key];
        if (next == null) continue;
        await cloudStep('guest_import.upsert', 'remote', () => this.remote.upsertDocument(user.id, {
          docKey: key,
          payload: next,
          updatedAt: new Date().toISOString(),
          deletedAt: null,
          revision: (remoteMap.get(key)?.revision ?? 0) + 1,
        }));
      }
      const after = await this.remote.listDocuments(user.id);
      if (stale()) return { ok: false, error: 'signed_out' };
      const remotePayload =
        after.find((doc) => doc.docKey === StorageKeys.repertoires.key)?.payload ?? null;
      const verified = repertoirePayloadCovers(remotePayload, vaultIds);
      await writePgnPresenceAudit(this.storage, {
        ...auditBase,
        at: new Date().toISOString(),
        remoteReachable: true,
        remoteVerified: verified,
        remoteFileIds: repertoireFileIds(remotePayload),
        note: verified
          ? 'Guest studies are present in Supabase. The device vault was kept.'
          : 'Supabase did not return every guest study. Local account cache was not replaced.',
      });
      if (!verified) return { ok: false, error: 'remote_unverified' };
    } catch {
      await writePgnPresenceAudit(this.storage, {
        ...auditBase,
        at: new Date().toISOString(),
        remoteReachable: false,
        remoteVerified: false,
        remoteFileIds: [],
        note: 'Upload failed. Guest studies were left on the device.',
      });
      return { ok: false, error: 'remote_unverified' };
    }
    if (stale()) return { ok: false, error: 'signed_out' };
    await this.withSilentWrites(async () => {
      for (const key of SYNCABLE_STORAGE_KEYS) {
        if (stale()) return;
        if (this.storage.updateItem) await this.storage.updateItem(key, live => stale() ? live : mergeDocumentPayload(key, live, merged[key] ?? null), 'cloud');
        else if (merged[key] != null) await this.storage.setItem(key, merged[key]!);
      }
      await cloudStep('workspace.mirror_preferences', 'local', () => this.mirrorPreferences());
      await cloudStep('workspace.mirror_profile', 'local', () => this.mirrorProfile());
    });
    if (stale()) return { ok: false, error: 'signed_out' };
    this.markPending();
    this.scheduleSync(50);
    await this.discardRepertoireCache();
    await this.parkWorkspace(user.id);
    return { ok: true, remoteVerified: true };
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

  private async showOwner(ownerId: string, parked?: { ownerId: string; mutation: number }): Promise<boolean> {
      if (ownerId === GUEST_OWNER_ID) {
        const current = this.state.user?.id ?? (await this.activeOwnerId());
        if (current && current !== GUEST_OWNER_ID) {
          // signOut has already verified this exact owner snapshot. Re-parking
          // wastes quota and may overwrite it with a partially restored guest
          // if showOwner is retried after a storage failure.
          if (parked?.ownerId !== current || parked.mutation !== this.mutationEpoch) {
            await this.parkWorkspace(current);
            if (parked) { parked.ownerId = current; parked.mutation = this.mutationEpoch; }
          }
        }
        else if (!(await activeDocsMatchAccount(this.storage))) {
          const live = await this.storage.getItem(StorageKeys.repertoires.key);
          await preserveGuestRepertoire(this.storage, live);
        }
      }
    const had = await this.restoreWorkspace(ownerId);
    await this.storage.setItem(CLOUD_ACTIVE_USER_KEY, ownerId);
    if (ownerId === GUEST_OWNER_ID) {
      await quarantineLegacyGuest(this.storage);
      await presentEmptyGuestLibrary(this.storage);
    }
    await applyDevicePreferences(this.storage);
    await this.withSilentWrites(async () => {
      await cloudStep('workspace.mirror_preferences', 'local', () => this.mirrorPreferences());
      await cloudStep('workspace.mirror_profile', 'local', () => this.mirrorProfile());
    });
    await this.invalidateDeferredWork();
    return had;
  }

  private async invalidateDeferredWork(): Promise<void> {
    try {
      const { pgnTranslationQueue } = await import('../pgnComments/PgnTranslationQueue.ts');
      if (pgnTranslationQueue.matchesStorage(this.storage)) {
        pgnTranslationQueue.discardHeldWork();
        const { pgnCommentTranslationStore } = await import('../pgnComments/PgnCommentTranslationStore.ts');
        pgnCommentTranslationStore.discardCachedSnapshot();
      }
    } catch {
      // Translation work is also stored in the account workspace.
    }
    await this.discardRepertoireCache();
  }

  private async discardRepertoireCache(): Promise<void> {
    if (this.storage !== defaultKeyValueStorage) return;
    try {
      const { repertoireService } = await import('../repertoire/index.ts');
      repertoireService.discardCachedSnapshot();
    } catch {
      // The next screen load reads storage again.
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
    const epoch = this.sessionEpoch;
    const current = () => this.sessionEpoch === epoch;
    try {
      if (!this.auth.configured) {
        this.setState({ status: 'unconfigured', user: null });
      } else {
        if (this.auth.hydrate) await this.auth.hydrate();
        if (!current()) return this.getState();
        const user = await this.auth.getUser();
        const backup = await this.storage.getItem(CLOUD_LAST_BACKUP_KEY);
        if (!current()) return this.getState();
        if (!user) {
          this.setState({ status: 'signed_out', user: null, lastBackupKey: backup });
          await quarantineLegacyGuest(this.storage);
          const owner = await this.activeOwnerId();
          if (owner !== GUEST_OWNER_ID) {
            await this.parkWorkspace(owner);
            await this.showOwner(GUEST_OWNER_ID);
          } else {
            await presentEmptyGuestLibrary(this.storage);
            await this.discardRepertoireCache();
          }
        } else {
          const active = await this.activeOwnerId();
          if (!current()) return this.getState();
          if (active !== user.id && active !== GUEST_OWNER_ID) {
            await this.parkWorkspace(active);
            if (!current()) return this.getState();
            await this.showOwner(user.id);
          } else {
            await this.storage.setItem(CLOUD_ACTIVE_USER_KEY, user.id);
          }
          if (!current()) return this.getState();
          this.setState({ user, lastBackupKey: backup, status: 'pending' });
          await this.sync();
          await this.settleAccountLifecycle();
        }
      }
    } catch (error) {
      if (!current()) return this.getState();
      if (this.state.user) {
        const diagnostic = reportCloudError('hydrate.restore', 'local', error);
        const offline = diagnostic.kind === 'offline';
        this.setState({
          status: offline ? 'offline' : 'error',
          lastError: this.state.lastError === 'local_save_failed' ? 'local_save_failed' : ['unexpected', 'offline'].includes(diagnostic.kind) ? 'sync_failed' : diagnostic.kind,
        });
      }
    } finally {
      if (!this.state.sessionReady) this.setState({ sessionReady: true });
    }
    return this.getState();
  }

  async signUp(email: string, password: string, options?: AuthAttemptOptions) {
    return this.authenticate(email, () => this.auth.signUp(email, password, options), 'signup', options);
  }

  async signIn(
    email: string,
    password: string,
    options?: { abandoned?: () => boolean },
  ) {
    return this.authenticate(email, () => this.auth.signIn(email, password, options), 'signin', options);
  }

  async resendSignupConfirmation(email: string) {
    if (!validAuthEmail(email)) return { ok: false, error: 'email_invalid' as const };
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
    if (!validAuthEmail(email)) return { ok: false, error: 'email_invalid' as const };
    return this.auth.recoverPassword(email);
  }

  async signOut(): Promise<{ ok: true } | { ok: false; error: 'unexpected'; reason?: CloudErrorKind }> {
    this.releaseAccountDeletion();
    const epoch = this.bumpSession();
    const accountId = this.state.user?.id ?? null;
    let parkedOwner = accountId;
    try {
      if (accountId) await this.parkWorkspace(accountId);
      else { await this.parkCurrentOwner(); parkedOwner = await this.activeOwnerId(); }
    } catch (error) {
      const diagnostic = reportCloudError('signout.park_workspace', 'local', error);
      if (!this.sessionIsCurrent(epoch)) return { ok: true };
      // Parking failed: keep the account session. Clearing the user first would
      // show guest mode while the account studies are still in the live store.
      this.setState({ lastError: diagnostic.kind, sessionReady: true });
      return { ok: false, error: 'unexpected', reason: diagnostic.kind };
    }
    const parked = { ownerId: parkedOwner ?? GUEST_OWNER_ID, mutation: this.mutationEpoch };
    setAuthDraftEmail('');
    const signedOut = {
      user: null,
      lastSyncedAt: null,
      status: this.auth.configured ? ('signed_out' as const) : ('unconfigured' as const),
      pendingConfirmationEmail: null,
      pendingConfirmationReason: null,
      sessionReady: true,
    };
    // The account copy is parked. Hide it before the auth round-trip finishes.
    this.setState({ ...signedOut, lastError: null });
    await this.discardRepertoireCache();
    try {
      await cloudStep('signout.end_auth_session', 'local', () => this.endAuthSession());
      if (!this.sessionIsCurrent(epoch)) return { ok: true };
      await cloudStep('signout.remove_session', 'local', () => this.storage.removeItem(CLOUD_SESSION_KEY));
      await cloudStep('signout.restore_guest', 'local', () => this.showOwner(GUEST_OWNER_ID, parked));
    } catch (error) {
      const diagnostic = reportCloudError('signout.finish', 'local', error);
      if (!this.sessionIsCurrent(epoch)) return { ok: true };
      if (parked.mutation !== this.mutationEpoch) {
        // Auth cleanup may have completed, but a newer local edit has not been
        // parked. Never clear it merely to display the guest workspace.
        this.setState({ status: 'error', lastError: diagnostic.kind, sessionReady: false });
        return { ok: false, error: 'unexpected', reason: diagnostic.kind };
      }
      await this.storage.removeItem(CLOUD_SESSION_KEY).catch(error => { reportCloudError('signout.retry_remove_session', 'local', error); });
      await this.showOwner(GUEST_OWNER_ID, parked).catch(async error => {
        reportCloudError('signout.retry_restore_guest', 'local', error);
        if (parked.mutation !== this.mutationEpoch) throw reportCloudError('signout.unparked_edit', 'local', new Error('workspace_changed_during_signout'));
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

  private authenticate(
    email: string,
    action: () => ReturnType<CloudAuth['signIn']>,
    source: 'signup' | 'signin',
    options?: AuthAttemptOptions,
  ): Promise<CloudAuthResult> {
    if (this.deletionLocked) return Promise.resolve({ ok: false, error: 'unexpected' });
    if (!validAuthEmail(email)) return Promise.resolve({ ok: false, error: 'email_invalid' });
    const requestKey = `${source}:${email.trim().toLowerCase()}`;
    if (this.authFlight && this.authFlightEpoch === this.sessionEpoch && !this.authAbandoned?.()) {
      return this.authFlightKey === requestKey ? this.authFlight : Promise.resolve({ ok: false, error: 'unexpected' });
    }
    const flight = this.authenticateOnce(email, action, source, options).catch((error): CloudAuthResult => { this.noteBackgroundFailure('auth.prepare_workspace',error); return { ok: false, error: 'local_save_failed' }; });
    this.authFlightEpoch = this.sessionEpoch;
    this.authFlightKey = requestKey;
    this.authAbandoned = options?.abandoned;
    const wrapped = flight.finally(() => { if (this.authFlight === wrapped) this.authFlight = null; });
    this.authFlight = wrapped;
    return wrapped;
  }

  private async authenticateOnce(
    email: string,
    action: () => ReturnType<CloudAuth['signIn']>,
    source: 'signup' | 'signin',
    options?: { abandoned?: () => boolean },
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
    if (!this.sessionIsCurrent(epoch) || options?.abandoned?.()) return { ok: false as const, error: 'unexpected' as const };
    const result = await action();
    if (!this.sessionIsCurrent(epoch)) return { ok: false as const, error: 'unexpected' as const };
    if (options?.abandoned?.()) {
      await this.endAuthSession();
      await this.storage.removeItem(CLOUD_SESSION_KEY);
      if (!this.sessionIsCurrent(epoch)) return { ok: false as const, error: 'unexpected' as const };
      this.setState({
        user: null,
        status: this.auth.configured ? 'signed_out' : 'unconfigured',
        pendingConfirmationEmail: null,
        pendingConfirmationReason: null,
        lastError: null,
        sessionReady: true,
      });
      return { ok: false as const, error: 'unexpected' as const };
    }
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
    setAuthDraftEmail('');
    this.setState({
      user: result.user,
      lastSyncedAt: null,
      status: 'pending',
      lastError: null,
      pendingConfirmationEmail: null,
      pendingConfirmationReason: null,
      sessionReady: true,
    });
    await applySignupProfile(this.storage, result.user, () => this.sessionIsCurrent(epoch));
    await this.mirrorProfile();
    if (!this.sessionIsCurrent(epoch)) return { ok: false as const, error: 'unexpected' as const };
    await authRequest(() => this.sync(), 2000).catch(() => undefined);
    if (this.state.user?.id !== result.user.id) return { ok: false as const, error: 'session_expired' as const };
    return result;
  }

  noteBackgroundFailure(stage: string,error:unknown):void {
    const diagnostic=reportCloudError(stage,'local',error);
    if(this.state.user)this.setState({status:'error',lastError:diagnostic.kind});
  }

  markOffline(): void {
    if (this.deletionLocked || !this.state.user || this.quotaBlocked) return;
    this.setState({ status: 'offline', lastError: null });
  }

  sync(options?: { allowCellular?: boolean; automatic?: boolean }): Promise<CloudEngineState> {
    if(this.disposed)return Promise.resolve(this.getState());
    if (options?.automatic && this.quotaBlocked) return Promise.resolve(this.getState());
    // A manual/network request replaces a scheduled retry, rather than leaving
    // another transfer to fire after this one has completed.
    if (this.syncTimer) { clearTimeout(this.syncTimer); this.syncTimer = null; }
    if (this.syncFlight) {
      return this.flightEpoch === this.sessionEpoch ? this.syncFlight : this.syncFlight.then(() => this.sync(options));
    }
    if(!options?.automatic)this.quotaBlocked=false;
    // Acquire before the first await, including transport/authentication probes.
    this.syncing = true;
    this.flightEpoch = this.sessionEpoch;
    this.followUpSync = false;
    const epoch = this.sessionEpoch;
    const flight = Promise.resolve().then(() => this.sessionIsCurrent(epoch) ? this.performSync(options) : this.getState()).catch(error => {
      const diagnostic = reportCloudError('sync.prepare', 'local', error);
      if (this.sessionIsCurrent(epoch)) this.setState({ status: 'error', lastError: diagnostic.kind });
      return this.getState();
    });
    const wrapped = flight.finally(() => {
      if (this.syncFlight === wrapped) {
        this.syncFlight = null;
        this.syncing = false;
      }
    });
    this.syncFlight = wrapped;
    return wrapped;
  }

  private async performSync(options?: { allowCellular?: boolean }): Promise<CloudEngineState> {
    if (this.deletionLocked) return this.getState();
    const deletion = await readDeletionPending(this.storage);
    if (deletion && deletion.userId === this.state.user?.id) {
      const { resumePendingAccountDeletion } = await import('./accountLifecycle.ts');
      await resumePendingAccountDeletion(this);
      if (await readDeletionPending(this.storage)) { this.noteDeletionUncertain(); return this.getState(); }
      if (!this.state.user) return this.getState();
    }
    const epoch = this.sessionEpoch;
    if (this.failedLocalKeys.size || this.state.lastError === 'local_save_failed') {
      this.setState({ status: 'error', lastError: 'local_save_failed' });
      return this.getState();
    }
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
    if (decision.offline) {
      this.setState({ user, status: 'offline', lastError: null });
      return this.getState();
    }
    this.setState({ user, status: 'syncing', lastError: null });
    try {
      const remoteDocs = await cloudStep('sync.list_documents', 'remote', () => this.remote.listDocuments(user.id));
      if (stale()) return this.getState();
      const remoteMap = new Map(remoteDocs.map((doc) => [doc.docKey, doc]));
      const localDocs = await cloudStep('sync.read_documents', 'local', () => readDocs(this.storage));
      if (stale()) return this.getState();
      if (SYNCABLE_STORAGE_KEYS.some(key => remoteMap.get(key)?.payload != null && remoteMap.get(key)?.payload !== localDocs[key])) {
        await cloudStep('sync.backup', 'local', () => this.backupLocal(false));
      }
      const merged: Record<string, string | null> = { ...localDocs };
      const push = async (key: (typeof SYNCABLE_STORAGE_KEYS)[number], payload: string) => {
        const sessionUser = await this.auth.getUser();
        if (stale() || !sessionUser || sessionUser.id !== ownerId) return false;
        await cloudStep('sync.upsert_document', 'remote', () => this.remote.upsertDocument(ownerId, {
          docKey: key,
          payload,
          updatedAt: new Date().toISOString(),
          deletedAt: null,
          revision: (remoteMap.get(key)?.revision ?? 0) + 1,
        }));
        const previous = remoteMap.get(key);
        remoteMap.set(key, { docKey: key, payload, updatedAt: new Date().toISOString(), deletedAt: null, revision: (previous?.revision ?? 0) + 1 });
        return true;
      };
      for (const key of SYNCABLE_STORAGE_KEYS) {
        if (stale()) return this.getState();
        const local = localDocs[key] ?? null;
        const remote = remoteMap.get(key)?.payload ?? null;
        const next = mergeDocumentPayload(key, local, remote);
        merged[key] = next;
        if (next == null || next === remoteMap.get(key)?.payload) continue;
        if (!(await push(key, next))) return this.getState();
      }
      if (stale()) return this.getState();
      const seen = this.mutationEpoch;
      const fresh = await cloudStep('sync.reread_documents', 'local', () => readDocs(this.storage));
      for (const key of SYNCABLE_STORAGE_KEYS) {
        if (stale()) return this.getState();
        if ((fresh[key] ?? null) === (localDocs[key] ?? null)) continue;
        const next = mergeDocumentPayload(key, fresh[key] ?? null, merged[key] ?? null);
        merged[key] = next;
        if (next == null || next === remoteMap.get(key)?.payload) continue;
        if (!(await push(key, next))) return this.getState();
      }
      if (this.mutationEpoch !== seen) this.followUpSync = true;
      if (stale()) return this.getState();
      const confirmed = new Map((await cloudStep('sync.verify_remote', 'remote', () => this.remote.listDocuments(ownerId))).map(doc => [doc.docKey, doc.payload]));
      if (stale()) return this.getState();
      for (const key of SYNCABLE_STORAGE_KEYS) {
        const combined = mergeDocumentPayload(key, merged[key] ?? null, confirmed.get(key) ?? null);
        if (combined !== (confirmed.get(key) ?? null)) this.followUpSync = true;
        merged[key] = combined;
      }
      for (const key of SYNCABLE_STORAGE_KEYS) {
        if (stale()) return this.getState();
        const apply = (onDisk: string | null) => {
          if (stale()) return onDisk;
          const safe = mergeDocumentPayload(key, onDisk, merged[key] ?? null);
          if (safe !== merged[key]) this.followUpSync = true;
          return safe;
        };
        if (this.storage.updateItem) await cloudStep('sync.apply_local', 'local', () => this.storage.updateItem!(key, apply, 'cloud'));
        else {
          const value = apply(await cloudStep('sync.apply_read', 'local', () => this.storage.getItem(key)));
          if (stale()) return this.getState();
          if (value != null) await cloudStep('sync.apply_write', 'local', () => this.storage.setItem(key, value));
        }
      }
      await cloudStep('workspace.mirror_preferences', 'local', () => this.mirrorPreferences());
      await cloudStep('workspace.mirror_profile', 'local', () => this.mirrorProfile());
      if (stale()) return this.getState();
      await this.settleAccountLifecycle();
      if (stale()) return this.getState();
      if (this.failedLocalKeys.size) this.noteLocalSaveFailure([...this.failedLocalKeys][0]);
      if (this.state.status === 'error' || this.state.status === 'offline') return this.getState();
      if (this.followUpSync) {
        this.setState({ status: 'pending', lastError: null });
      } else {
        this.setState({
          status: 'synced',
          lastSyncedAt: new Date().toISOString(),
          lastError: null,
        });
        this.retryAttempt = 0;
      }
    } catch (error) {
      if (stale()) return this.getState();
      const diagnostic = reportCloudError('sync.transfer', 'remote', error);
      const offline = diagnostic.kind === 'offline';
      this.setState({
        status: offline ? 'offline' : 'error',
        lastError: this.state.lastError === 'local_save_failed' ? 'local_save_failed' : ['unexpected', 'offline'].includes(diagnostic.kind) ? 'sync_failed' : diagnostic.kind,
      });
    } finally {
      if (!stale() && this.quotaBlocked) {
        this.followUpSync = false;
        if(this.syncTimer){clearTimeout(this.syncTimer);this.syncTimer=null;}
      } else if (!stale() && this.followUpSync && !this.deletionLocked && this.state.user) {
        this.followUpSync = false;
        if (this.retryAttempt < 3) this.scheduleSync([50, 1000, 5000][this.retryAttempt++]);
        else this.setState({ status: 'error', lastError: 'sync_failed' });
      } else if (!stale() && (this.state.status === 'error' || this.state.status === 'offline') && this.retryAttempt < 3) {
        this.scheduleSync([2000, 8000, 30000][this.retryAttempt++]);
      }
    }
    return this.getState();
  }

  markPending(): void {
    if (this.deletionLocked) return;
    if (this.state.user && this.state.status !== 'unconfigured') {
      this.setState({ status: 'pending' });
    }
  }

  noteLocalSaveFailure(key = '*'): void {
    this.failedLocalKeys.add(key);
    if (!this.state.user || this.deletionLocked) return;
    this.setState({ status: 'error', lastError: 'local_save_failed' });
  }

  noteAvatarTransferFailure(): void {
    if (!this.state.user || this.deletionLocked) return;
    this.setState({ status: 'error', lastError: 'avatar_transfer_failed' });
  }

  notifyLocalMutation(key = '*'): void {
    if(this.disposed)return;
    this.mutationEpoch += 1;
    this.failedLocalKeys.delete(key);
    if (!this.failedLocalKeys.size && this.state.lastError === 'local_save_failed') this.setState({ lastError: null });
    if (this.deletionLocked || !this.state.user) return;
    if(this.quotaBlocked)return;
    if (this.syncing) {
      this.followUpSync = true;
      if (this.state.status !== 'offline' && this.state.status !== 'waiting_wifi') {
        this.setState({ status: 'pending', lastError: null });
      }
      return;
    }
    if(this.quotaBlocked)return;
    void this.queueLocalMutation().catch(error=>this.noteBackgroundFailure('sync.queue_mutation',error));
  }

  private async queueLocalMutation(): Promise<void> {
    const epoch = this.sessionEpoch;
    const decision = await decideCloudTransfer(false);
    if (!this.sessionIsCurrent(epoch) || !this.state.user || this.deletionLocked || this.syncing || this.quotaBlocked) return;
    if (decision.offline) {
      this.setState({ status: 'offline', lastError: null });
      return;
    }
    this.markPending();
    this.scheduleSync();
  }

  scheduleSync(delayMs = 800): void {
    if (this.deletionLocked || this.quotaBlocked || this.disposed) return;
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => {
      this.syncTimer = null;
      void this.sync({automatic:true}).catch(error=>this.noteBackgroundFailure('sync.timer',error));
    }, delayMs);
    (this.syncTimer as unknown as { unref?: () => void }).unref?.();
  }
}

export async function restoreBackup(
  storage: KeyValueStorage,
  backupKey: string,
): Promise<boolean> {
  try {
    const raw = await storage.getItem(backupKey);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { ownerId?: string; docs?: Record<string, string | null> };
    const owner = (await storage.getItem(CLOUD_ACTIVE_USER_KEY)) ?? GUEST_OWNER_ID;
    if ((parsed.ownerId ?? GUEST_OWNER_ID) !== owner || !parsed.docs || typeof parsed.docs !== 'object' || Array.isArray(parsed.docs)) return false;
    if (SYNCABLE_STORAGE_KEYS.some(key => parsed.docs![key] != null && typeof parsed.docs![key] !== 'string')) return false;
    const before = await readDocs(storage);
    const recoveryKey = cloudBackupKey('before-restore-' + Date.now() + '-' + Math.random().toString(36).slice(2));
    await storage.setItem(recoveryKey, JSON.stringify({ version: 2, ownerId: owner, createdAt: new Date().toISOString(), docs: before }));
    await rememberBackup(storage, recoveryKey, owner);
    for (const key of SYNCABLE_STORAGE_KEYS) {
      if (((await storage.getItem(CLOUD_ACTIVE_USER_KEY)) ?? GUEST_OWNER_ID) !== owner) return false;
      const backup = parsed.docs[key] ?? null;
      if (!backup) continue;
      const merge = (live: string | null) => mergeDocumentPayload(key, live, backup);
      if (storage.updateItem) await storage.updateItem(key, merge);
      else await storage.setItem(key, merge(await storage.getItem(key))!);
    }
    return true;
  } catch {
    return false;
  }
}
