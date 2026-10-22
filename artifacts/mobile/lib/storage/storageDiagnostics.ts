import type { KeyValueStorage } from './KeyValueStorage.ts';
import { isSnapshotKey, snapshotReferences } from './snapshotStorage.ts';
import { SYNCABLE_STORAGE_KEYS, CLOUD_SESSION_KEY } from '../cloud/syncableKeys.ts';
/** UTF-8 payload estimate; excludes SQLite pages, indexes, WAL, native caches and framing overhead. */
export function approximateBytes(value: string): number {
  let n = 0;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c < 128) n++;
    else if (c < 2048) n += 2;
    else if (
      c >= 0xd800 &&
      c <= 0xdbff &&
      i + 1 < value.length &&
      value.charCodeAt(i + 1) >= 0xdc00 &&
      value.charCodeAt(i + 1) <= 0xdfff
    ) {
      n += 4;
      i++;
    } else n += 3;
  }
  return n;
}
const labels = [
  'openings',
  'gameLibrary',
  'commentTranslations',
  'translationQueue',
  'openingMastery',
  'preferences',
  'profile',
  'openingQuizRecords',
  'moveNaming',
  'playMove',
  'blindRecords',
  'puzzleHistory',
  'puzzleStreaks',
  'cultureHistory',
  'cultureFeedback',
  'endgameTraining',
  'theoreticalEndgame',
  'continueLine',
];
/** Read-only sequential scan; retains root values and numeric counters, never a durable copy. The report has no keys or IDs. */
export async function inspectStorage(storage: KeyValueStorage, stable: () => boolean = () => true) {
  const keys = [...((await storage.getAllKeys?.()) ?? [])];
  const bytes = new Map<string, number>(),
    roots = new Map<string, string | null>();
  let unreadable = 0,
    skippedSensitive = 0;
  for (const key of keys) {
    if (key === CLOUD_SESSION_KEY) {
      skippedSensitive++;
      continue;
    }
    try {
      const value = await storage.getItem(key);
      bytes.set(key, value == null ? 0 : approximateBytes(value));
      if (isSnapshotKey(key)) roots.set(key, value);
    } catch {
      unreadable++;
    }
  }
  const referenced = new Set<string>();
  let invalidRoots = 0,
    logicalSnapshotBytes = 0;
  for (const [key, raw] of roots) {
    try {
      const frame = snapshotReferences(key, raw);
      if (!frame) {
        logicalSnapshotBytes += bytes.get(key) ?? 0;
        continue;
      }
      let length = 0,
        hash = 2166136261,
        volume = 0;
      for (const part of frame.keys) {
        const text = await storage.getItem(part);
        if (text == null) throw new Error('incomplete');
        length += text.length;
        volume += approximateBytes(text);
        for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
      }
      if (length !== frame.length || hash >>> 0 !== frame.hash) throw new Error('integrity');
      for (const part of frame.keys) referenced.add(part);
      logicalSnapshotBytes += volume;
    } catch {
      invalidRoots++;
    }
  }
  const after = [...((await storage.getAllKeys?.()) ?? [])];
  let unchanged = keys.length === after.length && keys.every((k) => after.includes(k)) && stable();
  for (const [key, value] of roots) {
    try {
      if ((await storage.getItem(key)) !== value) unchanged = false;
    } catch {
      unchanged = false;
    }
  }
  unchanged = unchanged && stable();
  const chunks = keys.filter((k) => /\.v1\.chunks\.[a-z0-9-]+\.\d+$/.test(k));
  const generations = (list: string[]) =>
    new Set(list.map((k) => k.slice(0, k.lastIndexOf('.')))).size;
  const candidates = chunks.filter((k) => !referenced.has(k));
  const sum = (list: string[]) => list.reduce((n, k) => n + (bytes.get(k) ?? 0), 0);
  const backupRoots = keys.filter(
    (k) => isSnapshotKey(k) && k.startsWith('anychess.cloud.backup.'),
  );
  const workspaceRoots = keys.filter(
    (k) => isSnapshotKey(k) && k.startsWith('anychess.cloud.workspace.'),
  );
  return {
    version: 1,
    readOnly: true,
    approximate: true,
    keyEnumerationAvailable: typeof storage.getAllKeys === 'function',
    cleanupAllowed: false,
    categories: SYNCABLE_STORAGE_KEYS.map((key, i) => ({
      category: labels[i],
      bytes: bytes.get(key) ?? 0,
      unreadable: keys.includes(key) && !bytes.has(key),
    })),
    measuredPhysicalValueBytes: sum(keys),
    unreadableRows: unreadable,
    skippedSensitiveRows: skippedSensitive,
    snapshots: {
      workspaces: workspaceRoots.length,
      workspaceRootBytes: sum(workspaceRoots),
      backups: backupRoots.length,
      backupRootBytes: sum(backupRoots),
      backupPhysicalBytes: sum(
        keys.filter((k) => k.startsWith('anychess.cloud.backup.') && !k.endsWith('.index.v1')),
      ),
      workspacePhysicalBytes: sum(keys.filter((k) => k.startsWith('anychess.cloud.workspace.'))),
      logicalBytes: logicalSnapshotBytes,
      invalidOrUnreadableRoots:
        invalidRoots + keys.filter((k) => isSnapshotKey(k) && !roots.has(k)).length,
    },
    blocks: {
      count: chunks.length,
      bytes: sum(chunks),
      referencedCount: referenced.size,
      referencedBytes: sum([...referenced]),
      referencedGenerations: generations([...referenced]),
      unreferencedCandidateCount: candidates.length,
      unreferencedCandidateBytes: sum(candidates),
      candidateGenerations: generations(candidates),
      referencesComplete:
        typeof storage.getAllKeys === 'function' &&
        unchanged &&
        invalidRoots === 0 &&
        unreadable === 0,
      proofOfDisposableBlocks: false,
    },
    otherCopies: {
      guestVaultBytes: bytes.get('anychess.cloud.guestPgnVault.v1') ?? 0,
      avatarRows: keys.filter((k) => k.startsWith('anychess.avatar.')).length,
      avatarBytes: sum(keys.filter((k) => k.startsWith('anychess.avatar.'))),
    },
    limits:
      'Payload estimates only; native capacity/free space cannot be determined. Unreferenced blocks may be interrupted recovery copies. No cleanup is authorized.',
  };
}

export type StorageReport = Awaited<ReturnType<typeof inspectStorage>>;
