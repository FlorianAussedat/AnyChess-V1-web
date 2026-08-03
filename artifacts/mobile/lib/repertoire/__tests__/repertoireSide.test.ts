/**
 * Repertoire side metadata, migration, and mixed training tests.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyRepertoireStore,
  normalizeRepertoireStore,
  type RepertoireFolder,
} from '../storage/types.ts';
import {
  mixedTrainingKey,
  pickMixedLine,
  sideToPlayerColor,
  filterFoldersByReviewSide,
  filterEntriesByReviewSide,
} from '../MixedRepertoireTraining.ts';
import { buildRepertoire } from '../repertoireTree.ts';
import { ContinueLineRecentStorage } from '../../continueLine/ContinueLineRecentStorage.ts';

const MINI_PGN = `[Event "test"]
1. e4 e5 2. Nf3 Nc6 *`;

const BRANCHED_PGN = `[Event "a"]
1. e4 e5 2. Nf3 Nc6 *
[Event "b"]
1. d4 d5 2. c4 *
`;

describe('repertoire store migration', () => {
  it('migrates v1 snapshot without side to v2', () => {
    const snap = normalizeRepertoireStore({
      version: 1,
      folders: [
        {
          id: 'folder_old',
          name: 'Legacy',
          createdAt: '2020-01-01T00:00:00.000Z',
          updatedAt: '2020-01-01T00:00:00.000Z',
        },
      ],
      files: [],
    });
    assert.equal(snap.version, 2);
    assert.equal(snap.folders[0]?.side, undefined);
  });

  it('persists side on folder records', () => {
    const folder: RepertoireFolder = {
      id: 'f1',
      name: 'Sicilien',
      side: 'white',
      createdAt: '',
      updatedAt: '',
    };
    const snap = normalizeRepertoireStore({
      version: 2,
      folders: [folder],
      files: [],
    });
    assert.equal(snap.folders[0]?.side, 'white');
  });

  it('empty store is v2', () => {
    assert.deepEqual(emptyRepertoireStore(), { version: 2, folders: [], files: [] });
  });
});

describe('MixedRepertoireTraining', () => {
  it('builds stable mixed training keys', () => {
    assert.equal(mixedTrainingKey(['b', 'a']), 'a|b');
    assert.equal(mixedTrainingKey(['a', 'b']), 'a|b');
  });

  it('maps side to player color', () => {
    assert.equal(sideToPlayerColor('white'), 'w');
    assert.equal(sideToPlayerColor('black'), 'b');
  });

  it('picks from white and black repertoires with orientation per line', () => {
    const rep = buildRepertoire(MINI_PGN);
    const whiteFolder = {
      id: 'w1',
      name: 'White rep',
      side: 'white' as const,
      createdAt: '',
      updatedAt: '',
    };
    const blackFolder = {
      id: 'b1',
      name: 'Black rep',
      side: 'black' as const,
      createdAt: '',
      updatedAt: '',
    };
    const entries = [
      { folder: whiteFolder, repertoire: rep },
      { folder: blackFolder, repertoire: rep },
    ];

    let seq = 0;
    const rng = () => {
      seq += 1;
      return seq % 2 === 0 ? 0.9 : 0.1;
    };

    const pick1 = pickMixedLine(entries, { rng });
    const pick2 = pickMixedLine(entries, { rng });
    assert.ok(pick1);
    assert.ok(pick2);
    assert.ok(['white', 'black'].includes(pick1!.side));
    assert.equal(sideToPlayerColor(pick1!.side), pick1!.side === 'white' ? 'w' : 'b');
    if (pick1!.folderId !== pick2!.folderId) {
      assert.notEqual(pick1!.side, pick2!.side);
    }
  });

  it('avoids immediate line repetition via recent path ids', () => {
    const rep = buildRepertoire(BRANCHED_PGN);
    const folder = {
      id: 'f1',
      name: 'Rep',
      side: 'white' as const,
      createdAt: '',
      updatedAt: '',
    };
    const first = pickMixedLine([{ folder, repertoire: rep }], { rng: () => 0.1 });
    assert.ok(first);
    const pathKey = `${folder.id}:${first!.path.id}`;

    const second = pickMixedLine([{ folder, repertoire: rep }], {
      rng: () => 0.1,
      recentPathIds: [pathKey],
    });
    assert.ok(second);
    assert.notEqual(`${folder.id}:${second!.path.id}`, pathKey);
  });

  it('filters Review White / Black / All folder pools', () => {
    const folders: RepertoireFolder[] = [
      { id: 'w1', name: 'W1', side: 'white', createdAt: '', updatedAt: '' },
      { id: 'w2', name: 'W2', side: 'white', createdAt: '', updatedAt: '' },
      { id: 'b1', name: 'B1', side: 'black', createdAt: '', updatedAt: '' },
      { id: 'x1', name: 'Unset', createdAt: '', updatedAt: '' },
    ];

    assert.deepEqual(
      filterFoldersByReviewSide(folders, 'white').map((f) => f.id),
      ['w1', 'w2'],
    );
    assert.deepEqual(
      filterFoldersByReviewSide(folders, 'black').map((f) => f.id),
      ['b1'],
    );
    assert.deepEqual(
      filterFoldersByReviewSide(folders, 'all').map((f) => f.id),
      ['w1', 'w2', 'b1'],
    );
  });

  it('Review White / Black / All selection drives mixed picks to that side', () => {
    const rep = buildRepertoire(MINI_PGN);
    const whiteFolder: RepertoireFolder = {
      id: 'w1',
      name: 'White rep',
      side: 'white',
      createdAt: '',
      updatedAt: '',
    };
    const blackFolder: RepertoireFolder = {
      id: 'b1',
      name: 'Black rep',
      side: 'black',
      createdAt: '',
      updatedAt: '',
    };
    const allEntries = [
      { folder: whiteFolder, repertoire: rep },
      { folder: blackFolder, repertoire: rep },
    ];

    const whiteOnly = filterEntriesByReviewSide(allEntries, 'white');
    assert.equal(whiteOnly.length, 1);
    const whitePick = pickMixedLine(whiteOnly, { rng: () => 0.5 });
    assert.ok(whitePick);
    assert.equal(whitePick!.side, 'white');
    assert.equal(sideToPlayerColor(whitePick!.side), 'w');

    const blackOnly = filterEntriesByReviewSide(allEntries, 'black');
    assert.equal(blackOnly.length, 1);
    const blackPick = pickMixedLine(blackOnly, { rng: () => 0.5 });
    assert.ok(blackPick);
    assert.equal(blackPick!.side, 'black');
    assert.equal(sideToPlayerColor(blackPick!.side), 'b');

    const reviewAll = filterEntriesByReviewSide(allEntries, 'all');
    assert.equal(reviewAll.length, 2);

    const seen = new Set<string>();
    let seq = 0;
    const rng = () => {
      seq += 1;
      return seq % 2 === 0 ? 0.9 : 0.1;
    };
    for (let i = 0; i < 8; i++) {
      const pick = pickMixedLine(reviewAll, { rng });
      assert.ok(pick);
      seen.add(pick!.side);
    }
    assert.ok(seen.has('white'));
    assert.ok(seen.has('black'));
  });
});

describe('ContinueLineRecentStorage mixed keys', () => {
  it('tracks recent paths per mixed selection', async () => {
    const mem = new Map<string, string>();
    const kv = {
      getItem: async (k: string) => mem.get(k) ?? null,
      setItem: async (k: string, v: string) => {
        mem.set(k, v);
      },
      removeItem: async (k: string) => {
        mem.delete(k);
      },
    };
    const store = new ContinueLineRecentStorage(kv);
    const mixKey = mixedTrainingKey(['a', 'b']);
    await store.pushRecentPathId(mixKey, 'a:e4 e5');
    await store.pushRecentPathId(mixKey, 'b:e4 c5');
    const recent = await store.getRecentPathIds(mixKey);
    assert.deepEqual(recent, ['b:e4 c5', 'a:e4 e5']);
  });
});
