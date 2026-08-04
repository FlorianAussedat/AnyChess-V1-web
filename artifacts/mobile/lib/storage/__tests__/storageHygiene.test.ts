/**
 * Storage hygiene — registry, schema migrations, corruption handling.
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  MemoryKeyValueStorage,
  StorageKeys,
  corruptBackupKey,
  parseStoredJson,
  loadStoredJson,
  runStorageMigrations,
  readStorageSchemaVersion,
  CURRENT_STORAGE_SCHEMA_VERSION,
  clearStorageCorruptionReports,
  getRecentStorageCorruptionReports,
} from '../index.ts';
import { AsyncStorageRepertoireStorage } from '../../repertoire/storage/AsyncStorageRepertoireStorage.ts';
import { PuzzleHistoryStorage } from '../../puzzles/PuzzleHistoryStorage.ts';
import { PuzzleStreakStore } from '../../puzzles/PuzzleStreakStore.ts';
import { MoveNamingRecordsStore } from '../../moveNaming/MoveNamingRecords.ts';
import { PlayMoveRecordsStore } from '../../playMove/PlayMoveRecords.ts';

beforeEach(() => {
  clearStorageCorruptionReports();
});

describe('StorageKeys registry', () => {
  it('exposes stable keys for all known persistent features', () => {
    assert.equal(StorageKeys.repertoires.key, 'anychess.repertoire.v2');
    assert.equal(StorageKeys.repertoiresLegacyV1.key, 'anychess.repertoire.v1');
    assert.equal(StorageKeys.puzzleRecent.key, 'anychess.puzzles.recent.v1');
    assert.equal(StorageKeys.puzzleHistory.key, 'anychess.puzzles.history.v1');
    assert.equal(StorageKeys.puzzleStreaks.key, 'anychess.puzzles.streaks.v1');
    assert.equal(StorageKeys.moveNamingRecords.key, 'anychess.move-naming.records.v1');
    assert.equal(StorageKeys.moveNamingSession60.key, 'anychess.move-naming.session60.v1');
    assert.equal(StorageKeys.playMoveSession60.key, 'anychess.play-move.session60.v1');
    assert.equal(StorageKeys.continueLineRecent.key, 'anychess.continueLine.recent.v1');
    assert.equal(StorageKeys.mentalRecent.key, 'anychess.mental.recent.v1');
    assert.equal(StorageKeys.boardCoordinatesVisible.key, 'anychess.board.coordinatesVisible.v1');
    assert.equal(StorageKeys.voiceEnabled.key, 'anychess.audio.voiceEnabled.v1');
    assert.equal(StorageKeys.voiceEnabledLegacy.key, 'anychess.audio.soundEnabled.v1');
    assert.equal(StorageKeys.schemaVersion.key, 'anychess.storage.schemaVersion');
    assert.equal(
      StorageKeys.chessCultureFeedback.key,
      'anychess.chess-culture.feedback.v1',
    );
  });
});

describe('parseStoredJson / loadStoredJson', () => {
  it('returns fallback for missing keys', async () => {
    const storage = new MemoryKeyValueStorage();
    const result = await loadStoredJson(storage, 'k', [] as string[], (p) =>
      Array.isArray(p) ? (p as string[]) : null,
    );
    assert.equal(result.status, 'missing');
    assert.deepEqual(result.value, []);
    assert.equal(await storage.getItem('k'), null);
  });

  it('loads valid current JSON', async () => {
    const storage = new MemoryKeyValueStorage();
    await storage.setItem('k', JSON.stringify(['a', 'b']));
    const result = await loadStoredJson(storage, 'k', [] as string[], (p) =>
      Array.isArray(p) ? (p as string[]) : null,
    );
    assert.equal(result.status, 'ok');
    assert.deepEqual(result.value, ['a', 'b']);
  });

  it('does not overwrite corrupt JSON; quarantines backup', async () => {
    const storage = new MemoryKeyValueStorage();
    const bad = '{not-json';
    await storage.setItem('k', bad);
    const result = await loadStoredJson(storage, 'k', [] as string[], (p) =>
      Array.isArray(p) ? (p as string[]) : null,
    );
    assert.equal(result.status, 'corrupt');
    assert.deepEqual(result.value, []);
    assert.equal(await storage.getItem('k'), bad);
    assert.equal(await storage.getItem(corruptBackupKey('k')), bad);
    assert.equal(getRecentStorageCorruptionReports().length, 1);
  });

  it('treats validation failure as corrupt without wiping', () => {
    const result = parseStoredJson('{"x":1}', [] as string[], (p) =>
      Array.isArray(p) ? (p as string[]) : null,
    );
    assert.equal(result.status, 'corrupt');
    assert.equal(result.reason, 'validation_failed');
    assert.deepEqual(result.value, []);
  });
});

describe('runStorageMigrations', () => {
  it('stamps schema version from 0 → CURRENT without wiping feature data', async () => {
    const storage = new MemoryKeyValueStorage();
    await storage.setItem(StorageKeys.puzzleRecent.key, JSON.stringify(['p1']));
    await storage.setItem(
      StorageKeys.moveNamingRecords.key,
      JSON.stringify({ 3: 9 }),
    );

    assert.equal(await readStorageSchemaVersion(storage), 0);

    const first = await runStorageMigrations(storage);
    assert.equal(first.from, 0);
    assert.equal(first.to, CURRENT_STORAGE_SCHEMA_VERSION);
    assert.ok(first.stepsApplied >= 1);
    assert.equal(await readStorageSchemaVersion(storage), CURRENT_STORAGE_SCHEMA_VERSION);
    assert.equal(await storage.getItem(StorageKeys.puzzleRecent.key), JSON.stringify(['p1']));
    assert.equal(
      await storage.getItem(StorageKeys.moveNamingRecords.key),
      JSON.stringify({ 3: 9 }),
    );

    const second = await runStorageMigrations(storage);
    assert.equal(second.from, CURRENT_STORAGE_SCHEMA_VERSION);
    assert.equal(second.to, CURRENT_STORAGE_SCHEMA_VERSION);
    assert.equal(second.stepsApplied, 0);
  });
});

describe('repertoire storage hygiene', () => {
  it('loads current v2 snapshot', async () => {
    const storage = new MemoryKeyValueStorage();
    const snap = {
      version: 2 as const,
      folders: [
        {
          id: 'f1',
          name: 'Sicilian',
          createdAt: '2020-01-01',
          updatedAt: '2020-01-01',
        },
      ],
      files: [],
    };
    await storage.setItem(StorageKeys.repertoires.key, JSON.stringify(snap));
    const repo = new AsyncStorageRepertoireStorage(storage);
    const loaded = await repo.load();
    assert.equal(loaded.version, 2);
    assert.equal(loaded.folders[0]?.name, 'Sicilian');
  });

  it('migrates legacy v1 → v2 once and removes v1 key', async () => {
    const storage = new MemoryKeyValueStorage();
    const legacy = {
      version: 1 as const,
      folders: [
        {
          id: 'f1',
          name: 'French',
          createdAt: '2020-01-01',
          updatedAt: '2020-01-01',
        },
      ],
      files: [],
    };
    await storage.setItem(StorageKeys.repertoiresLegacyV1.key, JSON.stringify(legacy));
    const repo = new AsyncStorageRepertoireStorage(storage);
    const loaded = await repo.load();
    assert.equal(loaded.version, 2);
    assert.equal(loaded.folders[0]?.name, 'French');
    assert.ok(await storage.getItem(StorageKeys.repertoires.key));
    assert.equal(await storage.getItem(StorageKeys.repertoiresLegacyV1.key), null);

    // Idempotent: second load reads v2 only
    const again = await repo.load();
    assert.equal(again.folders[0]?.name, 'French');
  });

  it('returns empty on corrupt repertoire without wiping primary key', async () => {
    const storage = new MemoryKeyValueStorage();
    const bad = '<<<corrupt>>>';
    await storage.setItem(StorageKeys.repertoires.key, bad);
    const repo = new AsyncStorageRepertoireStorage(storage);
    const loaded = await repo.load();
    assert.deepEqual(loaded.folders, []);
    assert.equal(await storage.getItem(StorageKeys.repertoires.key), bad);
    assert.equal(
      await storage.getItem(corruptBackupKey(StorageKeys.repertoires.key)),
      bad,
    );
  });
});

describe('puzzle / move-naming stores', () => {
  it('loads missing puzzle history as empty arrays', async () => {
    const storage = new MemoryKeyValueStorage();
    const hist = new PuzzleHistoryStorage(storage);
    assert.deepEqual(await hist.getRecentIds(), []);
    assert.deepEqual(await hist.getHistory(), []);
  });

  it('preserves corrupt puzzle recent until an explicit write', async () => {
    const storage = new MemoryKeyValueStorage();
    const bad = 'not-json';
    await storage.setItem(StorageKeys.puzzleRecent.key, bad);
    const hist = new PuzzleHistoryStorage(storage);
    assert.deepEqual(await hist.getRecentIds(), []);
    assert.equal(await storage.getItem(StorageKeys.puzzleRecent.key), bad);

    await hist.pushRecentId('p1');
    assert.deepEqual(await hist.getRecentIds(), ['p1']);
  });

  it('loads streak state and survives corrupt JSON', async () => {
    const storage = new MemoryKeyValueStorage();
    const store = new PuzzleStreakStore(storage);
    assert.deepEqual(await store.getSnapshot(), {
      currentByBand: {},
      bestByBand: {},
    });

    await storage.setItem(StorageKeys.puzzleStreaks.key, '{bad');
    assert.deepEqual(await store.getSnapshot(), {
      currentByBand: {},
      bestByBand: {},
    });
    assert.equal(await storage.getItem(StorageKeys.puzzleStreaks.key), '{bad');
  });

  it('loads move-naming defaults when key missing or corrupt', async () => {
    const storage = new MemoryKeyValueStorage();
    const records = new MoveNamingRecordsStore(storage);
    const empty = await records.load();
    assert.equal(empty[3], 0);

    await storage.setItem(StorageKeys.moveNamingRecords.key, '[]');
    const fallback = await records.load();
    assert.equal(fallback[1], 0);
    assert.equal(await storage.getItem(StorageKeys.moveNamingRecords.key), '[]');
  });

  it('loads session60 best defaults for move-naming and play-move', async () => {
    const storage = new MemoryKeyValueStorage();
    const moveNaming = new MoveNamingRecordsStore(storage);
    assert.equal(await moveNaming.loadBest(), 0);
    await moveNaming.saveScore(6);
    assert.equal(await moveNaming.loadBest(), 6);

    const playMove = new PlayMoveRecordsStore(storage);
    assert.equal(await playMove.loadBest(), 0);
    await playMove.saveScore(4);
    assert.equal(await playMove.loadBest(), 4);
  });
});
