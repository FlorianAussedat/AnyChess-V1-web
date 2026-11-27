import pako from 'pako';
import type { KeyValueStorage } from './KeyValueStorage.ts';
import { serializedUpdate } from './serializedUpdate.ts';
import {
  snapshotHash,
  isSnapshotKey,
  readSnapshot,
  snapshotReferences,
} from './snapshotStorage.ts';
import { SYNCABLE_STORAGE_KEYS } from '../cloud/syncableKeys.ts';
import { cloudStep, classifyCloudError } from '../cloud/diagnostics.ts';

/** Immutable compressed blocks shared by active documents, workspaces and backups.
 * Legacy plain JSON and PR127/128 chunks are read without startup migration.
 * No shared block or logical recovery root is ever deleted here. Hashes locate candidates only:
 * content is read, decompressed and compared before any candidate is reused.
 */
const ROOT = '@anychess/shared-documents/1:';
const PACKED = '@deflate/1:';
const LITERAL = '@literal/1:';
const BLOCK = 'anychess.storage.pool.v1.chunks.';
const PART_SIZE = 64 * 1024;
const INLINE = 4096;
const MAX_LOGICAL_UNITS = 64 * 1024 * 1024;
type Part = { key: string; length: number; hash: number };
type Value = { parts: Part[]; length: number; hash: number };
type Root =
  | { value: Value }
  | {
      header: Record<string, unknown>;
      docs: Record<string, string | null | Value>;
    };
export function usesSharedStorage(key: string) {
  return (
    isSnapshotKey(key) ||
    (SYNCABLE_STORAGE_KEYS as readonly string[]).includes(key)
  );
}
export function isSharedBlock(key: string) {
  return key.startsWith(BLOCK);
}
function valueRef(value: unknown): value is Value {
  if (!value || typeof value !== 'object') return false;
  const v = value as Value;
  return (
    Array.isArray(v.parts) &&
    v.parts.length > 0 &&
    v.parts.length <= 10000 &&
    Number.isSafeInteger(v.length) &&
    v.length >= 0 &&
    v.length <= MAX_LOGICAL_UNITS &&
    v.parts.reduce((n, p) => n + (p?.length ?? 0), 0) === v.length &&
    Number.isInteger(v.hash) &&
    v.parts.every(
      (p) =>
        p &&
        typeof p.key === 'string' &&
        /^anychess\.storage\.pool\.v1\.chunks\.[a-z0-9-]+\.0$/.test(p.key) &&
        Number.isInteger(p.length) &&
        p.length > 0 &&
        p.length <= PART_SIZE &&
        Number.isInteger(p.hash),
    )
  );
}
function root(raw: string | null): Root | null {
  if (!raw?.startsWith(ROOT)) return null;
  const v = JSON.parse(raw.slice(ROOT.length)) as Root;
  if ('value' in v) {
    if (!valueRef(v.value)) throw new Error('shared_manifest_invalid');
  } else if (
    !v.header ||
    typeof v.header !== 'object' ||
    Array.isArray(v.header) ||
    !v.docs ||
    typeof v.docs !== 'object' ||
    Array.isArray(v.docs) ||
    Object.values(v.docs).some(
      (d) => d !== null && typeof d !== 'string' && !valueRef(d),
    )
  )
    throw new Error('shared_manifest_invalid');
  return v;
}
function encode(text: string): string {
  const bytes = pako.deflate(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i++)
    binary += String.fromCharCode(bytes[i]);
  const packed = PACKED + btoa(binary);
  // JSON/PGN is generally compressible; don't expand incompressible data.
  return packed.length < LITERAL.length + text.length ? packed : LITERAL + text;
}
function decode(raw: string, expected: Part): string {
  let text = raw.startsWith(LITERAL) ? raw.slice(LITERAL.length) : raw;
  if (!raw.startsWith(LITERAL) && !raw.startsWith(PACKED))
    throw new Error('shared_encoding_invalid');
  if (raw.startsWith(PACKED)) {
    const binary = atob(raw.slice(PACKED.length));
    if (binary.length > PART_SIZE * 4) throw new Error('shared_block_invalid');
    const input = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const inflater = new pako.Inflate({ to: 'string', chunkSize: 16384 });
    let total = 0;
    const chunks: string[] = [];
    inflater.onData = (s: string) => {
      total += s.length;
      if (total > expected.length) throw new Error('shared_inflate_limit');
      chunks.push(s);
    };
    inflater.push(input, true);
    if (inflater.err) throw new Error('shared_inflate_failed');
    text = chunks.join('');
  }
  if (text.length !== expected.length || snapshotHash(text) !== expected.hash)
    throw new Error('shared_block_integrity');
  return text;
}
async function readValue(storage: KeyValueStorage, value: Value) {
  const chunks: string[] = [];
  for (const part of value.parts) {
    const raw = await storage.getItem(part.key);
    if (raw === null) throw new Error('shared_block_missing');
    chunks.push(decode(raw, part));
  }
  const text = chunks.join('');
  if (text.length !== value.length || snapshotHash(text) !== value.hash)
    throw new Error('shared_document_integrity');
  return text;
}
export async function readSharedDocument(
  storage: KeyValueStorage,
  key: string,
): Promise<string | null> {
  const raw = await storage.getItem(key),
    frame = root(raw);
  if (!frame) return isSnapshotKey(key) ? readSnapshot(storage, key) : raw;
  if ('value' in frame) return readValue(storage, frame.value);
  const docs: Record<string, string | null> = Object.create(null);
  for (const [k, v] of Object.entries(frame.docs))
    docs[k] =
      typeof v === 'object' && v !== null ? await readValue(storage, v) : v;
  return JSON.stringify({ ...frame.header, docs });
}
async function writeValue(
  storage: KeyValueStorage,
  text: string,
): Promise<Value> {
  const parts: Part[] = [];
  for (let at = 0; at < text.length;) {
    let end = Math.min(text.length, at + PART_SIZE);
    if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1])) end--;
    const slice = text.slice(at, end),
      hash = snapshotHash(slice),
      stem = `${hash.toString(36)}-${slice.length}`;
    const part = await serializedUpdate(
      storage,
      `shared-block:${stem}`,
      async () => {
        for (let suffix = 0; suffix < 100; suffix++) {
          const ref = {
            key: `${BLOCK}${stem}${suffix ? '-' + suffix : ''}.0`,
            length: slice.length,
            hash,
          };
          const existing = await storage.getItem(ref.key);
          if (existing !== null) {
            try {
              if (decode(existing, ref) === slice) return ref;
            } catch {
              /* Never overwrite an ambiguous block. */
            }
            continue;
          }
          const encoded = encode(slice);
          await cloudStep('storage.pool.block_write', 'local', () =>
            storage.setItem(ref.key, encoded),
          );
          const saved = await storage.getItem(ref.key);
          if (saved === null || decode(saved, ref) !== slice)
            throw new Error('shared_block_verify');
          return ref;
        }
        throw new Error('shared_block_collision');
      },
    );
    parts.push(part);
    at = end;
  }
  return { parts, length: text.length, hash: snapshotHash(text) };
}
export async function writeSharedDocument(
  storage: KeyValueStorage,
  key: string,
  value: string,
  compact = false,
): Promise<void> {
  if (value.length > MAX_LOGICAL_UNITS)
    throw new Error('SQLITE_TOOBIG shared logical document limit');
  // Preserve PR127's narrowly scoped repair of an oversized legacy snapshot row:
  // the caller supplies intact active documents. Unreadable active docs or missing/
  // corrupt snapshot blocks still stop the operation; backups are never bypassed.
  if (!compact) {
    try {
      if ((await readSharedDocument(storage, key)) === value) return;
    } catch (error) {
      if (
        !isSnapshotKey(key) ||
        classifyCloudError(error, 'local') !== 'local_size_limit'
      )
        throw error;
      let oversizedLegacyRoot = false;
      try {
        await storage.getItem(key);
      } catch (rootError) {
        oversizedLegacyRoot =
          classifyCloudError(rootError, 'local') === 'local_size_limit';
      }
      if (!oversizedLegacyRoot) throw error;
    }
  }
  let frame: Root | null = null;
  if (value.length >= INLINE) {
    let envelope: {
      docs: Record<string, string | null>;
      [key: string]: unknown;
    } | null = null;
    if (isSnapshotKey(key)) {
      try {
        const v = JSON.parse(value);
        if (
          v &&
          typeof v === 'object' &&
          v.docs &&
          typeof v.docs === 'object' &&
          !Array.isArray(v.docs) &&
          Object.values(v.docs).every(
            (d) => d === null || typeof d === 'string',
          )
        )
          envelope = v;
      } catch {
        /* Non-envelope snapshots remain ordinary values. */
      }
    }
    if (envelope) {
      const { docs, ...header } = envelope;
      if (JSON.stringify({ ...header, docs }) !== value) envelope = null;
    }
    if (envelope) {
      const { docs, ...header } = envelope;
      const references: Record<string, string | null | Value> = Object.create(null);
      for (const [k, v] of Object.entries(docs))
        references[k] =
          typeof v === 'string' && v.length >= INLINE
            ? await writeValue(storage, v)
            : v;
      frame = { header, docs: references };
    } else frame = { value: await writeValue(storage, value) };
  }
  const raw = frame ? ROOT + JSON.stringify(frame) : value;
  await cloudStep('storage.pool.publish', 'local', () =>
    storage.setItem(key, raw),
  );
  if ((await storage.getItem(key)) !== raw)
    throw new Error('shared_root_verify');
  // Each block was verified before publication. No superseded blocks are purged.
}
export function sharedReferences(raw: string | null): string[] | null {
  const frame = root(raw);
  if (!frame) return null;
  return [
    ...new Set(
      ('value' in frame
        ? [frame.value]
        : Object.values(frame.docs).filter(valueRef)
      ).flatMap((v) => v.parts.map((p) => p.key)),
    ),
  ];
}

/** Re-encode one verified legacy root; never clean arbitrary orphan generations.
 * Called under the adapter root lock. Only the old committed, fully read chunks
 * of this very key may be removed after the new logical value matches exactly.
 */
export async function compactSharedDocument(
  storage: KeyValueStorage,
  key: string,
): Promise<void> {
  const raw = await storage.getItem(key);
  if (
    raw === null ||
    raw.startsWith(ROOT) ||
    (raw.length < INLINE && !raw.startsWith('@anychess/snapshot-chunks/1:'))
  )
    return;
  const previous = isSnapshotKey(key) ? snapshotReferences(key, raw) : null;
  const value = await readSharedDocument(storage, key);
  if (value === null) throw new Error('shared_compact_missing');
  await writeSharedDocument(storage, key, value, true);
  if ((await readSharedDocument(storage, key)) !== value)
    throw new Error('shared_compact_verify');
  // Unlike old speculative generations, these exact old committed chunks now
  // have a verified replacement, and no other legacy root can refer to this key's chunks.
  for (const part of previous?.keys ?? []) {
    try {
      await storage.removeItem(part);
    } catch {
      /* Keep residual bytes if removal fails. */
    }
  }
}
