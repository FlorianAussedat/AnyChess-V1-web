/**
 * Guest opening studies stay on the device until the user copies them into
 * a chosen account. The vault is not a sync document and is never deleted
 * automatically. The live repertoire shown while signed out has no personal files.
 */
import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import { StorageKeys } from '../storage/StorageKeys.ts';
import { mergeDocumentPayload } from './mergeDocuments.ts';
import { activeDocsMatchAccount, parseWorkspace } from './accountSpace.ts';
import { CLOUD_ACTIVE_USER_KEY, GUEST_OWNER_ID, cloudWorkspaceKey } from './syncableKeys.ts';

export const GUEST_PGN_VAULT_KEY = 'anychess.cloud.guestPgnVault.v1';
export const PGN_PRESENCE_AUDIT_KEY = 'anychess.cloud.pgnPresence.v1';

export type PgnPresenceAudit = {
  at: string;
  userId: string;
  remoteReachable: boolean;
  remoteVerified: boolean;
  remoteFileIds: string[];
  vaultFileIds: string[];
  note: string;
};

export function repertoireFileIds(payload: string | null | undefined): string[] {
  if (!payload) return [];
  try {
    const parsed = JSON.parse(payload) as { files?: { id?: string }[] };
    if (!Array.isArray(parsed.files)) return [];
    return parsed.files
      .map((file) => file?.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
  } catch {
    return [];
  }
}

export function repertoirePayloadCovers(
  payload: string | null | undefined,
  ids: readonly string[],
): boolean {
  const present = new Set(repertoireFileIds(payload));
  return ids.every((id) => present.has(id));
}

export function stripPersonalPgnFiles(payload: string): string {
  const parsed = JSON.parse(payload) as { files?: unknown };
  if (!parsed || typeof parsed !== 'object') return payload;
  return JSON.stringify({ ...parsed, files: [] });
}

function unionRepertoire(parts: readonly (string | null | undefined)[]): string | null {
  let merged: string | null = null;
  for (const part of parts) {
    if (!part) continue;
    merged = mergeDocumentPayload(StorageKeys.repertoires.key, merged, part);
  }
  return merged;
}

async function parkedGuestRepertoire(storage: KeyValueStorage): Promise<string | null> {
  const raw = await storage.getItem(cloudWorkspaceKey(GUEST_OWNER_ID));
  const workspace = parseWorkspace(raw, GUEST_OWNER_ID);
  return workspace?.docs[StorageKeys.repertoires.key] ?? null;
}

/**
 * Keep every guest study. Account documents are not copied into the vault:
 * the caller passes `livePayload` only when that payload is the guest library.
 */
export async function preserveGuestRepertoire(
  storage: KeyValueStorage,
  livePayload: string | null,
): Promise<string | null> {
  const vault = await storage.getItem(GUEST_PGN_VAULT_KEY);
  const parked = await parkedGuestRepertoire(storage);
  const merged = unionRepertoire([vault, parked, livePayload]);
  if (merged && repertoireFileIds(merged).length > 0) {
    await storage.setItem(GUEST_PGN_VAULT_KEY, merged);
  }
  return merged;
}

export async function hideLivePersonalPgns(storage: KeyValueStorage): Promise<void> {
  const live = await storage.getItem(StorageKeys.repertoires.key);
  if (!live || repertoireFileIds(live).length === 0) return;
  await storage.setItem(StorageKeys.repertoires.key, stripPersonalPgnFiles(live));
}

/** Seal guest studies, then remove them from the library that the UI reads. */
export async function presentEmptyGuestLibrary(storage: KeyValueStorage): Promise<void> {
  const owner = (await storage.getItem(CLOUD_ACTIVE_USER_KEY)) ?? GUEST_OWNER_ID;
  if (owner !== GUEST_OWNER_ID) return;
  const live = await storage.getItem(StorageKeys.repertoires.key);
  if (await activeDocsMatchAccount(storage)) {
    await hideLivePersonalPgns(storage);
    return;
  }
  await preserveGuestRepertoire(storage, live);
  await hideLivePersonalPgns(storage);
}

export async function guestVaultHasStudies(storage: KeyValueStorage): Promise<boolean> {
  const vault = await storage.getItem(GUEST_PGN_VAULT_KEY);
  return repertoireFileIds(vault).length > 0;
}

export async function writePgnPresenceAudit(
  storage: KeyValueStorage,
  audit: PgnPresenceAudit,
): Promise<void> {
  await storage.setItem(PGN_PRESENCE_AUDIT_KEY, JSON.stringify(audit));
}
