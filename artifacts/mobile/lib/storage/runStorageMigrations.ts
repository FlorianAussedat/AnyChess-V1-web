/**
 * Apply pending app-level storage migrations in order, then stamp CURRENT.
 */
import type { KeyValueStorage } from './KeyValueStorage.ts';
import { defaultKeyValueStorage } from './AsyncKeyValueStorage.ts';
import { STORAGE_MIGRATIONS } from './migrations.ts';
import {
  CURRENT_STORAGE_SCHEMA_VERSION,
  readStorageSchemaVersion,
  writeStorageSchemaVersion,
} from './schemaVersion.ts';

export type RunMigrationsResult = {
  from: number;
  to: number;
  stepsApplied: number;
};

/**
 * Idempotent: re-running at CURRENT is a no-op.
 * Never wipes feature keys as part of the runner itself.
 */
export async function runStorageMigrations(
  storage: KeyValueStorage = defaultKeyValueStorage,
): Promise<RunMigrationsResult> {
  const from = await readStorageSchemaVersion(storage);
  let current = from;
  let stepsApplied = 0;

  if (current > CURRENT_STORAGE_SCHEMA_VERSION) {
    // Newer client wrote a higher stamp — do not downgrade or touch data.
    return { from, to: current, stepsApplied: 0 };
  }

  while (current < CURRENT_STORAGE_SCHEMA_VERSION) {
    const step = STORAGE_MIGRATIONS.find((m) => m.from === current);
    if (!step) {
      throw new Error(
        `Missing storage migration from schema v${current} toward v${CURRENT_STORAGE_SCHEMA_VERSION}`,
      );
    }
    if (step.to <= step.from) {
      throw new Error(
        `Invalid storage migration: v${step.from} → v${step.to}`,
      );
    }
    await step.migrate(storage);
    current = step.to;
    await writeStorageSchemaVersion(storage, current);
    stepsApplied += 1;
  }

  return { from, to: current, stepsApplied };
}
