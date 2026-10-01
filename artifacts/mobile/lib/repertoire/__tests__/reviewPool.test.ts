/**
 * Unified opening PGN pool — review activation, balanced pick, ephemeral filter.
 */
import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { buildRepertoire } from '../repertoireTree.ts';
import {
  isFileEnabledForReview,
  isFileVisibleInLearning,
  isFolderEnabledForReview,
  needsOppositeSideMoveConfirm,
} from '../reviewActivation.ts';
import {
  countReviewLines,
  listReviewPoolEntries,
  flattenReviewLines,
  pickReviewLine,
  resetReviewPickMemory,
} from '../pickReviewLine.ts';
import {
  clearEphemeralOpeningSession,
  ephemeralSessionForOrigin,
  getEphemeralOpeningSession,
  isOpeningExercisePath,
  leaveEphemeralOpeningExercise,
  releaseEphemeralOpeningSessionIfLeaving,
  setEphemeralOpeningSession,
} from '../ephemeralOpeningSession.ts';
import { hasAssignedRepertoireSide } from '../folderSide.ts';
import { repertoireFromSans } from '../repertoireFromSans.ts';
import type { RepertoireFolder, StoredPgnFile } from '../storage/types.ts';

const SMALL = '[Event "small"]\n\n1. e4 e5 *';
const BIG = '[Event "big"]\n\n1. d4 d5 (1... Nf6) 2. c4 (2. Nf3) *';

function folder(
  id: string,
  side: 'white' | 'black',
  enabled?: boolean,
): RepertoireFolder {
  return {
    id,
    name: id,
    side,
    enabled,
    createdAt: '',
    updatedAt: '',
  };
}

function file(
  id: string,
  folderId: string,
  pgn: string,
  enabled?: boolean,
): StoredPgnFile {
  const parsed = buildRepertoire(pgn);
  return {
    id,
    folderId,
    filename: `${id}.pgn`,
    importedAt: '',
    pgnText: pgn,
    enabled,
    summary: {
      gameCount: parsed.headers.length,
      positionCount: parsed.positionCount,
      branchCount: parsed.branchCount,
      parseSucceeded: parsed.positionCount > 0,
      errors: [],
      warnings: [],
    },
  };
}

describe('review activation', () => {
  it('disabled folder excludes every child even if the file flag is on', () => {
    const f = folder('w', 'white', false);
    const pgn = file('a', 'w', SMALL, true);
    assert.equal(isFolderEnabledForReview(f), false);
    assert.equal(isFileEnabledForReview(f, pgn), false);
    assert.equal(listReviewPoolEntries([f], [pgn]).length, 0);
  });

  it('disabled PGN is excluded from Review', () => {
    const f = folder('w', 'white', true);
    const pgn = file('a', 'w', SMALL, false);
    assert.equal(isFileEnabledForReview(f, pgn), false);
    assert.equal(listReviewPoolEntries([f], [pgn]).length, 0);
  });

  it('disabled PGN stays visible in Learning', () => {
    const pgn = file('a', 'w', SMALL, false);
    assert.equal(isFileVisibleInLearning(pgn), true);
  });

  it('legacy missing enabled means on', () => {
    const f = folder('w', 'white');
    const pgn = file('a', 'w', SMALL);
    assert.equal(isFolderEnabledForReview(f), true);
    assert.equal(isFileEnabledForReview(f, pgn), true);
  });

  it('unassigned side is not reviewable', () => {
    const f: RepertoireFolder = {
      id: 'x',
      name: 'x',
      createdAt: '',
      updatedAt: '',
    };
    const pgn = file('a', 'x', SMALL, true);
    assert.equal(hasAssignedRepertoireSide(f.side), false);
    assert.equal(isFolderEnabledForReview(f), false);
    assert.equal(isFileEnabledForReview(f, pgn), false);
    assert.equal(listReviewPoolEntries([f], [pgn]).length, 0);
  });

  it('an enabled unsided folder stays out of Review until White or Black is chosen', () => {
    const unsided: RepertoireFolder = {
      id: 'legacy',
      name: 'Ancien dossier',
      enabled: true,
      createdAt: '',
      updatedAt: '',
    };
    const sided = folder('w', 'white', true);
    const leftover = file('legacy-pgn', 'legacy', SMALL, true);
    const active = file('a', 'w', SMALL, true);
    const pool = listReviewPoolEntries([unsided, sided], [leftover, active]);
    assert.equal(pool.length, 1);
    assert.equal(pool[0]!.file.id, 'a');
  });
});

describe('uniform review pick per line', () => {
  beforeEach(() => resetReviewPickMemory());

  it('builds a flat pool of every line, so a huge PGN has more slots than a small one', () => {
    const white = folder('w', 'white', true);
    const small = file('small', 'w', SMALL, true);
    const big = file('big', 'w', BIG, true);
    const entries = listReviewPoolEntries([white], [small, big]);
    const pool = flattenReviewLines(entries);
    const smallSlots = pool.filter((p) => p.file.id === 'small').length;
    const bigSlots = pool.filter((p) => p.file.id === 'big').length;
    assert.equal(smallSlots, 1);
    assert.ok(bigSlots > smallSlots);
    assert.equal(pool.length, countReviewLines(entries));
  });

  it('picks uniformly among flattened lines (index = floor(rng * N))', () => {
    const white = folder('w', 'white', true);
    const small = file('small', 'w', SMALL, true);
    const big = file('big', 'w', BIG, true);
    const entries = listReviewPoolEntries([white], [small, big]);
    const pool = flattenReviewLines(entries);
    const first = pickReviewLine(entries, { rng: () => 0 });
    const last = pickReviewLine(entries, { rng: () => 0.999999 });
    assert.equal(first?.file.id, pool[0]?.file.id);
    assert.equal(first?.path.id, pool[0]?.path.id);
    assert.equal(last?.file.id, pool[pool.length - 1]?.file.id);
    assert.equal(last?.path.id, pool[pool.length - 1]?.path.id);
  });

  it('keeps mastered and priority lines in the Review pool', () => {
    const white = folder('w', 'white', true);
    const starred = file('star', 'w', SMALL, true);
    starred.priority = true;
    const entries = listReviewPoolEntries([white], [starred]);
    assert.equal(flattenReviewLines(entries).length, 1);
    const pick = pickReviewLine(entries, { rng: () => 0 });
    assert.equal(pick?.file.id, 'star');
  });
});

describe('opposite-side move confirmation', () => {
  it('requires confirmation when moving white -> black', () => {
    assert.equal(
      needsOppositeSideMoveConfirm(folder('a', 'white'), folder('b', 'black')),
      true,
    );
    assert.equal(
      needsOppositeSideMoveConfirm(folder('a', 'white'), folder('b', 'white')),
      false,
    );
  });
});

describe('ephemeral opening session', () => {
  beforeEach(() => leaveEphemeralOpeningExercise());

  function studyLine() {
    return {
      fileId: 'study-line',
      folderId: 'study-folder',
      pathSans: ['e4', 'c5'],
      pathId: 'e4 c5',
      sourcePgn: '[Event "study"]\n\n1. e4 c5 *',
      displayName: 'Jouer cette ligne',
      side: 'white' as const,
      origin: 'study' as const,
    };
  }

  it('does not touch persistent flags and clears on demand', () => {
    const f = folder('w', 'white', true);
    const pgn = file('a', 'w', SMALL, true);
    assert.equal(pgn.enabled, true);
    setEphemeralOpeningSession({
      fileId: pgn.id,
      folderId: f.id,
      pathSans: ['e4', 'e5'],
      pathId: 'e4 e5',
      sourcePgn: SMALL,
      displayName: 'a',
      side: 'white',
      origin: 'study',
    });
    assert.equal(getEphemeralOpeningSession()?.fileId, 'a');
    assert.equal(pgn.enabled, true);
    assert.equal(f.enabled, true);
    clearEphemeralOpeningSession();
    assert.equal(getEphemeralOpeningSession(), null);
  });

  it('launches Jouer cette ligne then drops it on every exit from the exercise', () => {
    setEphemeralOpeningSession(studyLine());
    assert.equal(getEphemeralOpeningSession()?.origin, 'study');
    assert.equal(ephemeralSessionForOrigin('study')?.fileId, 'study-line');

    leaveEphemeralOpeningExercise();
    assert.equal(getEphemeralOpeningSession(), null);

    setEphemeralOpeningSession(studyLine());
    assert.equal(
      releaseEphemeralOpeningSessionIfLeaving('/openings/play', '/openings'),
      true,
    );
    assert.equal(getEphemeralOpeningSession(), null);

    setEphemeralOpeningSession(studyLine());
    assert.equal(
      releaseEphemeralOpeningSessionIfLeaving(
        '/openings/continue?from=study',
        '/openings/learn',
      ),
      true,
    );
    assert.equal(getEphemeralOpeningSession(), null);

    setEphemeralOpeningSession(studyLine());
    assert.equal(
      releaseEphemeralOpeningSessionIfLeaving('/openings/play', '/parties/analyzer'),
      true,
    );
    assert.equal(getEphemeralOpeningSession(), null);

    setEphemeralOpeningSession(studyLine());
    assert.equal(
      releaseEphemeralOpeningSessionIfLeaving('/openings/play/', '/'),
      true,
    );
    assert.equal(getEphemeralOpeningSession(), null);

    setEphemeralOpeningSession(studyLine());
    leaveEphemeralOpeningExercise();
    assert.equal(getEphemeralOpeningSession(), null);
  });

  it('keeps the parked line while staying on play or continue (ligne suivante)', () => {
    setEphemeralOpeningSession(studyLine());
    assert.equal(
      releaseEphemeralOpeningSessionIfLeaving(
        '/openings/play?from=study',
        '/openings/play?from=review',
      ),
      false,
    );
    assert.equal(getEphemeralOpeningSession()?.fileId, 'study-line');
    assert.equal(
      releaseEphemeralOpeningSessionIfLeaving('/openings/play', '/openings/continue'),
      false,
    );
    assert.equal(getEphemeralOpeningSession()?.origin, 'study');
    assert.equal(isOpeningExercisePath('/openings/play?from=study'), true);
    assert.equal(isOpeningExercisePath('/openings/manage'), false);
  });

  it('a leftover study line cannot hijack a later Review — the active pool is used', () => {
    const white = folder('w', 'white', true);
    const active = file('pool-pgn', 'w', SMALL, true);
    const entries = listReviewPoolEntries([white], [active]);
    assert.equal(entries.length, 1);
    assert.equal(entries[0]!.file.id, 'pool-pgn');

    setEphemeralOpeningSession(studyLine());
    assert.equal(ephemeralSessionForOrigin('review'), null);
    assert.equal(getEphemeralOpeningSession(), null);

    const pick = pickReviewLine(entries, { rng: () => 0 });
    assert.ok(pick);
    assert.equal(pick!.file.id, 'pool-pgn');
    assert.notEqual(pick!.file.id, 'study-line');
  });

  it('linear repertoire from a selected line cannot wander into other branches', () => {
    const rep = repertoireFromSans(['e4', 'e5', 'Nf3']);
    assert.equal(rep.trainingPaths?.length, 1);
    assert.deepEqual(rep.trainingPaths?.[0]?.sans, ['e4', 'e5', 'Nf3']);
  });
});
