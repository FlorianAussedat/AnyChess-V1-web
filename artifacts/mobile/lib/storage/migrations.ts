/**
 * Ordered app-level storage migrations.
 *
 * Existing on-disk data predating the schema stamp is treated as version 0.
 * v0 → v1 only introduces the version key — no payload rewrites — so current
 * repertoires / records / preferences keep working unchanged.
 *
 * Document-level migrations (e.g. repertoire v1 → v2) remain in their stores.
 */
import type { StorageMigration } from './schemaVersion.ts';

export const STORAGE_MIGRATIONS: readonly StorageMigration[] = [
  {
    from: 0,
    to: 1,
    async migrate() {
      // Schema registry introduction — keys and shapes are already current.
    },
  },
];
