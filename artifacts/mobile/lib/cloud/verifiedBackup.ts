import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import { serializedUpdate } from '../storage/serializedUpdate.ts';
import { docsEqual } from './accountSpace.ts';
import { readBackupIndex, rememberBackup } from './backupIndex.ts';
import { cloudBackupKey } from './syncableKeys.ts';
import { snapshotHash } from '../storage/snapshotStorage.ts';
/** Immutable recovery copies, deduplicated only after complete read/owner/doc comparison. */
export function verifiedBackup(
  storage: KeyValueStorage,
  ownerId: string,
  docs: Record<string, string | null>,
): Promise<string> {
  return serializedUpdate(storage, 'cloud.verified-backup', async () => {
    const roots = (await storage.getAllKeys?.()) ?? [];
    const candidates = [
      ...new Set([
        ...(await readBackupIndex(storage))
          .filter((row) => row.ownerId === ownerId)
          .map((row) => row.key),
        ...roots.filter(
          (key) => /^anychess\.cloud\.backup\..+\.v1$/.test(key) && !key.endsWith('.index.v1'),
        ),
      ]),
    ];
    const same = (raw: string | null) => {
      if (!raw) return false;
      try {
        const copy = JSON.parse(raw);
        return (
          copy.ownerId === ownerId &&
          copy.docs &&
          typeof copy.docs === 'object' &&
          !Array.isArray(copy.docs) &&
          Object.values(copy.docs).every((value) => value === null || typeof value === 'string') &&
          docsEqual(copy.docs, docs)
        );
      } catch {
        return false;
      }
    };
    for (const key of candidates) {
      let raw: string | null;
      try {
        raw = await storage.getItem(key);
      } catch {
        continue;
      } // Keep unreadable copies; never trust them for recovery.
      if (same(raw)) {
        await rememberBackup(storage, key, ownerId);
        return key;
      }
    }
    // Stable content, including stable field order, permits retries of incomplete
    // generations after restart. Fingerprints locate candidates; they never prove equality.
    const payload = JSON.stringify({ version: 2, ownerId, docs });
    const stem = `verified-${snapshotHash(payload).toString(36)}-${payload.length}`;
    for (let suffix = 0; suffix < 100; suffix++) {
      const key = cloudBackupKey(stem + (suffix ? `-${suffix}` : ''));
      const existing = await storage.getItem(key);
      if (existing && !same(existing)) continue; // Hash collision: preserve this other copy.
      if (!existing) {
        if (storage.updateItem)
          await storage.updateItem(
            key,
            (current) => {
              if (current && !same(current)) throw new Error('backup_collision');
              return current ?? payload;
            },
            'cloud',
          );
        else await storage.setItem(key, payload);
      }
      if (!same(await storage.getItem(key))) throw new Error('backup_verify_failed');
      await rememberBackup(storage, key, ownerId);
      return key;
    }
    throw new Error('backup_collision');
  });
}
