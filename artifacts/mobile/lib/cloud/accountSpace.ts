import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import {
  CLOUD_LEGACY_GUEST_KEY,
  GUEST_OWNER_ID,
  SYNCABLE_STORAGE_KEYS,
  cloudWorkspaceKey,
} from './syncableKeys.ts';

export type WorkspaceOrigin = 'guest' | 'account' | 'legacy';

export type WorkspaceEnvelope = {
  ownerId: string;
  origin: WorkspaceOrigin;
  docs: Record<string, string | null>;
  parkedAt?: string;
};

export async function readSyncableDocs(
  storage: KeyValueStorage,
): Promise<Record<string, string | null>> {
  const docs: Record<string, string | null> = {};
  for (const key of SYNCABLE_STORAGE_KEYS) {
    docs[key] = await storage.getItem(key);
  }
  return docs;
}

export async function writeSyncableDocs(
  storage: KeyValueStorage,
  docs: Record<string, string | null>,
): Promise<void> {
  for (const key of SYNCABLE_STORAGE_KEYS) {
    const value = docs[key];
    if (value == null) await storage.removeItem(key);
    else await storage.setItem(key, value);
  }
}

export function emptySyncableDocs(): Record<string, string | null> {
  return Object.fromEntries(SYNCABLE_STORAGE_KEYS.map((key) => [key, null]));
}

export function docsAreEmpty(docs: Record<string, string | null> | null | undefined): boolean {
  if (!docs) return true;
  return SYNCABLE_STORAGE_KEYS.every((key) => docs[key] == null);
}

export function docsEqual(
  left: Record<string, string | null> | null | undefined,
  right: Record<string, string | null> | null | undefined,
): boolean {
  for (const key of SYNCABLE_STORAGE_KEYS) {
    if ((left?.[key] ?? null) !== (right?.[key] ?? null)) return false;
  }
  return true;
}

export function parseWorkspace(raw: string | null, fallbackOwner: string): WorkspaceEnvelope | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      ownerId?: string;
      origin?: string;
      docs?: Record<string, string | null>;
      parkedAt?: string;
    };
    const ownerId = parsed.ownerId || fallbackOwner;
    const origin: WorkspaceOrigin =
      parsed.origin === 'guest' || parsed.origin === 'account' || parsed.origin === 'legacy'
        ? parsed.origin
        : ownerId === GUEST_OWNER_ID
          ? 'legacy'
          : 'account';
    return {
      ownerId,
      origin,
      docs: parsed.docs ?? {},
      parkedAt: parsed.parkedAt,
    };
  } catch {
    return null;
  }
}

export function workspaceEnvelope(
  ownerId: string,
  docs: Record<string, string | null>,
): WorkspaceEnvelope {
  return {
    ownerId,
    origin: ownerId === GUEST_OWNER_ID ? 'guest' : 'account',
    docs,
    parkedAt: new Date().toISOString(),
  };
}

async function accountWorkspaceKeys(storage: KeyValueStorage): Promise<string[]> {
  const keys = (await storage.getAllKeys?.()) ?? [];
  const guestKey = cloudWorkspaceKey(GUEST_OWNER_ID);
  return keys.filter(
    (key) => key.startsWith('anychess.cloud.workspace.') && key.endsWith('.v1') && key !== guestKey,
  );
}

/** True when the active documents are already stored under some account id. */
export async function activeDocsMatchAccount(storage: KeyValueStorage): Promise<boolean> {
  const live = await readSyncableDocs(storage);
  if (docsAreEmpty(live)) return false;
  for (const key of await accountWorkspaceKeys(storage)) {
    const envelope = parseWorkspace(await storage.getItem(key), '');
    if (envelope && docsEqual(live, envelope.docs)) return true;
  }
  return false;
}

/**
 * A guest snapshot written before origins existed may be a copy of account A.
 * Keep that copy under the legacy key, and stop using it as the guest space
 * once any account workspace exists. Account workspaces are left as they are.
 */
export async function quarantineLegacyGuest(storage: KeyValueStorage): Promise<void> {
  const accounts = await accountWorkspaceKeys(storage);
  if (accounts.length === 0) return;
  const guestKey = cloudWorkspaceKey(GUEST_OWNER_ID);
  const raw = await storage.getItem(guestKey);
  const guest = parseWorkspace(raw, GUEST_OWNER_ID);
  if (!guest || guest.origin === 'guest') return;
  if (!(await storage.getItem(CLOUD_LEGACY_GUEST_KEY)) && raw) {
    await storage.setItem(CLOUD_LEGACY_GUEST_KEY, raw);
  }
  const live = await readSyncableDocs(storage);
  const wasShowingGuest = docsEqual(live, guest.docs);
  await storage.setItem(
    guestKey,
    JSON.stringify(workspaceEnvelope(GUEST_OWNER_ID, emptySyncableDocs())),
  );
  if (wasShowingGuest) await writeSyncableDocs(storage, emptySyncableDocs());
}
