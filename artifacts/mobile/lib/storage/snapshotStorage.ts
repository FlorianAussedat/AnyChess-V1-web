import { classifyCloudError, reportCloudError, cloudStep } from '../cloud/diagnostics.ts';
import type { KeyValueStorage } from './KeyValueStorage.ts';
/** Snapshot-only physical framing. Legacy plain values remain readable; no startup migration. */
const PREFIX = '@anychess/snapshot-chunks/1:';
export const SNAPSHOT_CHUNK_SIZE = 64 * 1024; // UTF-16 units, at most 256 KiB UTF-8.
export function isSnapshotKey(key: string): boolean {
  return (
    /^anychess\.cloud\.(workspace|backup)\..+\.v1$/.test(key) &&
    key !== 'anychess.cloud.backup.index.v1'
  );
}
type Manifest = { generation: string; count: number; length: number; hash: number };
export function snapshotHash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
function manifest(raw: string | null): Manifest | null {
  if (!raw?.startsWith(PREFIX)) return null;
  const m = JSON.parse(raw.slice(PREFIX.length));
  if (
    !m ||
    !/^[a-z0-9-]+$/.test(m.generation) ||
    !Number.isInteger(m.count) ||
    m.count < 1 ||
    m.count > 10000 ||
    !Number.isInteger(m.length) ||
    m.length < 0 ||
    !Number.isInteger(m.hash)
  )
    throw new Error('snapshot_invalid');
  return m;
}
const chunkKey = (key: string, m: Manifest, i: number) => `${key}.chunks.${m.generation}.${i}`;
export async function readSnapshot(storage: KeyValueStorage, key: string): Promise<string | null> {
  const raw = await storage.getItem(key);
  const m = manifest(raw);
  if (!m) return raw;
  const chunks: string[] = [];
  for (let i = 0; i < m.count; i++) {
    const chunk = await storage.getItem(chunkKey(key, m, i));
    if (chunk == null) throw new Error('snapshot_chunk_missing');
    chunks.push(chunk);
  }
  const text = chunks.join('');
  if (text.length !== m.length || snapshotHash(text) !== m.hash)
    throw new Error('snapshot_integrity');
  return text;
}
export async function writeSnapshot(
  storage: KeyValueStorage,
  key: string,
  value: string,
): Promise<void> {
  // Only read the small old marker if possible. An oversized legacy row must not
  // prevent replacement by a fresh snapshot built from the intact active docs.
  let previous: Manifest | null = null;
  let previousRaw: string | null = null;
  try {
    previousRaw = await storage.getItem(key);
    previous = manifest(previousRaw);
  } catch (error) {
    if (classifyCloudError(error, 'local') !== 'local_size_limit') throw error;
    reportCloudError('storage.snapshot.legacy_row_unreadable', 'local', error);
  }
  if (previousRaw === value || (previous && (await readSnapshot(storage, key)) === value)) return;
  if (value.length <= SNAPSHOT_CHUNK_SIZE) {
    await storage.setItem(key, value);
    if ((await storage.getItem(key)) !== value) throw new Error('snapshot_verify_failed');
  } else {
    const chunks: string[] = [];
    for (let offset = 0; offset < value.length;) {
      let end = Math.min(value.length, offset + SNAPSHOT_CHUNK_SIZE);
      if (end < value.length && /[\uD800-\uDBFF]/.test(value[end - 1])) end--;
      chunks.push(value.slice(offset, end));
      offset = end;
    }
    const next: Manifest = {
      generation: `resume-${snapshotHash(value).toString(36)}-${value.length}`,
      count: chunks.length,
      length: value.length,
      hash: snapshotHash(value),
    };
    // Check every pre-existing block before writing anything. Never overwrite
    // bytes of an ambiguous previous attempt, even on a fingerprint collision.
    const present: boolean[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const existing = await storage.getItem(chunkKey(key, next, i));
      if (existing != null && existing !== chunks[i]) throw new Error('snapshot_staging_collision');
      present.push(existing != null);
    }
    for (let i = 0; i < chunks.length; i++) {
      const part = chunkKey(key, next, i);
      if (!present[i])
        await cloudStep(`storage.snapshot.block_write.${i}`, 'local', () =>
          storage.setItem(part, chunks[i]),
        );
      if ((await storage.getItem(part)) !== chunks[i]) throw new Error('snapshot_verify_failed');
    }
    // Publish only after every new chunk has been read back. A failed/ambiguous
    // commit keeps the old snapshot and/or the complete new generation available.
    await cloudStep('storage.snapshot.publish', 'local', () =>
      storage.setItem(key, PREFIX + JSON.stringify(next)),
    );
    if ((await readSnapshot(storage, key)) !== value) throw new Error('snapshot_verify_failed');
  }
  // Called under the adapter's per-key read/write lock. Never remove backups or
  // other generations on failure; cleanup only the superseded committed chunks.
  if (previous)
    for (let i = 0; i < previous.count; i++)
      await storage.removeItem(chunkKey(key, previous, i)).catch((error) => {
        reportCloudError('storage.snapshot.cleanup_superseded', 'local', error);
      });
}
export async function removeSnapshot(storage: KeyValueStorage, key: string): Promise<void> {
  const raw = await storage.getItem(key);
  const m = manifest(raw);
  await storage.removeItem(key);
  const owned = storage.getAllKeys
    ? (await storage.getAllKeys()).filter((part) => part.startsWith(`${key}.chunks.`))
    : m
      ? Array.from({ length: m.count }, (_, i) => chunkKey(key, m, i))
      : [];
  for (const part of owned) await storage.removeItem(part);
}

/** Internal metadata only. Never expose owner-bearing keys/generation IDs in logs. */
export function snapshotReferences(
  key: string,
  raw: string | null,
): { keys: string[]; length: number; hash: number } | null {
  const m = manifest(raw);
  return m
    ? {
        keys: Array.from({ length: m.count }, (_, i) => chunkKey(key, m, i)),
        length: m.length,
        hash: m.hash,
      }
    : null;
}
