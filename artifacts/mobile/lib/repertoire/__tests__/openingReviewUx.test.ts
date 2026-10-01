/**
 * Review line bilan, comment lookup, stable naming, and one-shot persist.
 */
import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { translate } from '../../i18n/messages.ts';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { OpeningMasteryStore } from '../OpeningMasteryStore.ts';
import {
  OpeningReviewAttempt,
  countUserMovesToFind,
  reviewResultFromAttempt,
} from '../openingReviewAttempt.ts';
import { reviewLineDisplayName, isGenericReviewLineName } from '../reviewLineName.ts';
import {
  commentOnReviewedLineLastMove,
  commentOnReviewedLinePly,
} from '../reviewLineComment.ts';
import {
  commitOpeningReviewAttempt,
  resetOpeningReviewRecordedFlag,
} from '../recordOpeningRevision.ts';
import { reviewBilanMessage } from '../../openings/presentReviewLineBilan.ts';
import { buildRepertoire } from '../repertoireTree.ts';
import { reviewPickToSession } from '../pickReviewLine.ts';
import {
  leaveEphemeralOpeningExercise,
  setEphemeralOpeningSession,
} from '../ephemeralOpeningSession.ts';
import type { RepertoireFolder, StoredPgnFile } from '../storage/types.ts';
import type { ContinueLinePath } from '../../continueLine/types.ts';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../..');

function read(rel: string): string {
  return readFileSync(join(mobileRoot, rel), 'utf8');
}

const TWO_BRANCH_PGN = `[Event "Two branches"]
[Opening "King's Pawn"]
[Result "*"]

1. e4 {Shared e4} c5 {Sicilian} (1... e5 {Open games} 2. Nf3 {Develop against e5} Nc6 3. Bb5 {Spanish}) 2. Nf3 {Open Sicilian prep} d6 {Najdorf structure} *
`;

const LAST_BLACK_COMMENT_PGN = `[Event "Italian"]
[Opening "Italian Game"]
[Variation "Giuoco Piano"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 {Black develops and prepares Bb4 or Bc5.} *
`;

const NO_COMMENT_PGN = `[Event "Silent"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 *
`;

function folder(): RepertoireFolder {
  return {
    id: 'w',
    name: 'White',
    side: 'white',
    createdAt: '',
    updatedAt: '',
  };
}

function file(pgn: string, displayName = 'Mon fichier'): StoredPgnFile {
  const parsed = buildRepertoire(pgn);
  return {
    id: 'f1',
    folderId: 'w',
    filename: 'line.pgn',
    displayName,
    importedAt: '',
    pgnText: pgn,
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

function session(pathId = 'p1') {
  return {
    fileId: 'f1',
    folderId: 'w',
    pathSans: ['e4', 'e5', 'Nf3', 'Nc6'],
    pathId,
    sourcePgn: NO_COMMENT_PGN,
    displayName: 'Mon fichier',
    lineName: 'Italian Game',
    side: 'white' as const,
    origin: 'review' as const,
  };
}

describe('countUserMovesToFind', () => {
  it('counts only the reviewed side', () => {
    const sans = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'];
    assert.equal(countUserMovesToFind(sans, 'w'), 3);
    assert.equal(countUserMovesToFind(sans, 'b'), 3);
    assert.equal(countUserMovesToFind(['e4', 'e5', 'Nf3'], 'w'), 2);
    assert.equal(countUserMovesToFind(['e4', 'e5', 'Nf3'], 'b'), 1);
  });
});

describe('OpeningReviewAttempt', () => {
  it('treats a clean finish as a success', () => {
    const attempt = new OpeningReviewAttempt(12);
    const snap = attempt.snapshot();
    assert.equal(snap.userMovesToFind, 12);
    assert.equal(snap.errorMoveCount, 0);
    assert.equal(snap.revealedMoveCount, 0);
    assert.equal(snap.isSuccess, true);
    assert.equal(reviewResultFromAttempt(snap), 'success');
  });

  it('counts several wrong tries on the same ply as one error-move', () => {
    const attempt = new OpeningReviewAttempt(12);
    attempt.markError(4);
    attempt.markError(4);
    attempt.markError(4);
    const snap = attempt.snapshot();
    assert.equal(snap.errorMoveCount, 1);
    assert.equal(snap.isSuccess, false);
    assert.equal(reviewResultFromAttempt(snap), 'failure');
  });

  it('keeps an error after undo-to-think', () => {
    const attempt = new OpeningReviewAttempt(4);
    attempt.markError(2);
    // Undo does not call any clear API — the ply stays recorded.
    const snap = attempt.snapshot();
    assert.equal(snap.errorMoveCount, 1);
    assert.equal(snap.isSuccess, false);
  });

  it('a reveal without an error is still a completed failure', () => {
    const attempt = new OpeningReviewAttempt(8);
    attempt.markReveal(3);
    const snap = attempt.snapshot();
    assert.equal(snap.revealedMoveCount, 1);
    assert.equal(snap.errorMoveCount, 0);
    assert.equal(snap.isSuccess, false);
    assert.equal(reviewResultFromAttempt(snap), 'failure');
  });

  it('revealing the continuation also blocks success', () => {
    const attempt = new OpeningReviewAttempt(6);
    attempt.markContinuationRevealed();
    assert.equal(attempt.snapshot().isSuccess, false);
  });
});

describe('review line comments stay on the reviewed branch', () => {
  it('shows the expected-move comment of the Sicilian branch, not Spanish', () => {
    const sicilian = ['e4', 'c5', 'Nf3', 'd6'];
    const expectedC5 = commentOnReviewedLinePly(TWO_BRANCH_PGN, sicilian, 1);
    assert.equal(expectedC5?.comment, 'Sicilian');
    const nf3 = commentOnReviewedLinePly(TWO_BRANCH_PGN, sicilian, 2);
    assert.equal(nf3?.comment, 'Open Sicilian prep');
    assert.doesNotMatch(expectedC5?.comment ?? '', /Open games|Spanish/);
  });

  it('shows the Open-games comment when that variation is the reviewed line', () => {
    const open = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'];
    const e5 = commentOnReviewedLinePly(TWO_BRANCH_PGN, open, 1);
    assert.equal(e5?.comment, 'Open games');
    const bb5 = commentOnReviewedLineLastMove(TWO_BRANCH_PGN, open);
    assert.equal(bb5?.comment, 'Spanish');
    assert.doesNotMatch(e5?.comment ?? '', /Sicilian|Najdorf/);
  });

  it('finds the final comment when the last move is Black / computer', () => {
    const line = ['e4', 'e5', 'Nf3', 'Nc6'];
    const last = commentOnReviewedLineLastMove(LAST_BLACK_COMMENT_PGN, line);
    assert.match(last?.comment ?? '', /Black develops/);
    assert.equal(commentOnReviewedLinePly(LAST_BLACK_COMMENT_PGN, line, 2), null);
  });

  it('returns null when the line has no comment', () => {
    const line = ['e4', 'e5', 'Nf3', 'Nc6'];
    assert.equal(commentOnReviewedLineLastMove(NO_COMMENT_PGN, line), null);
    assert.equal(commentOnReviewedLinePly(NO_COMMENT_PGN, line, 0), null);
  });

  it('does not invent a comment for a SAN that was not played on this branch', () => {
    const sicilian = ['e4', 'c5', 'Nf3', 'd6'];
    assert.equal(commentOnReviewedLinePly(TWO_BRANCH_PGN, sicilian, 4), null);
  });
});

describe('stable review line name', () => {
  it('prefers the stored path label over the file name', () => {
    assert.equal(
      reviewLineDisplayName({
        pathLabel: 'Italian Game · Giuoco Piano',
        fileDisplayName: 'mes-lignes.pgn',
      }),
      'Italian Game · Giuoco Piano',
    );
  });

  it('uses PGN headers then the file name, and skips AnyChess line', () => {
    assert.equal(isGenericReviewLineName('AnyChess line'), true);
    assert.equal(
      reviewLineDisplayName({
        pathLabel: 'AnyChess line',
        headers: { Opening: 'Sicilian Defense', Variation: 'Najdorf' },
        fileDisplayName: 'fichier',
      }),
      'Sicilian Defense · Najdorf',
    );
    assert.equal(
      reviewLineDisplayName({
        pathLabel: 'AnyChess line',
        headers: { Event: 'AnyChess line' },
        fileDisplayName: 'Dragon accéléré',
      }),
      'Dragon accéléré',
    );
  });

  it('attaches header names to training paths the computer will play', () => {
    const rep = buildRepertoire(LAST_BLACK_COMMENT_PGN);
    const path = rep.trainingPaths?.[0];
    assert.ok(path);
    assert.deepEqual(path.sans, ['e4', 'e5', 'Nf3', 'Nc6']);
    assert.equal(path.sourceLabel, 'Italian Game · Giuoco Piano');
  });

  it('stores that line name on the Review session', () => {
    const paths = buildRepertoire(LAST_BLACK_COMMENT_PGN).trainingPaths ?? [];
    const pickPath = paths[0] as ContinueLinePath;
    const parked = reviewPickToSession(
      {
        file: file(LAST_BLACK_COMMENT_PGN, 'Mon PGN'),
        folder: folder(),
        side: 'white',
        path: pickPath,
      },
      'review',
    );
    assert.equal(parked.lineName, 'Italian Game · Giuoco Piano');
    assert.equal(parked.displayName, 'Mon PGN');
    assert.deepEqual(parked.pathSans, pickPath.sans);
  });
});

describe('review bilan copy includes the finished attempt', () => {
  it('formats the French example', () => {
    const message = reviewBilanMessage({
      lineName: 'Italian Game · Giuoco Piano',
      stats: {
        userMovesToFind: 12,
        errorMoveCount: 2,
        revealedMoveCount: 1,
        revealedContinuation: false,
        isSuccess: false,
      },
      totalAttempts: 5,
      totalSuccesses: 3,
    });
    assert.match(message, /Italian Game · Giuoco Piano/);
    assert.match(message, /2 coups avec erreur sur 12 coups à trouver/);
    assert.match(message, /1 coup révélé/);
    assert.match(message, /Cette ligne : 5 révisions terminées · 3 réussites/);
  });

  it('keeps English copy in sync', () => {
    assert.equal(translate('en', 'openings.lineFinishedTitle'), 'Line finished');
    assert.match(translate('en', 'openings.seeFinalComment'), /final comment/i);
  });
});

describe('commitOpeningReviewAttempt records once', () => {
  beforeEach(() => {
    leaveEphemeralOpeningExercise();
  });

  it('writes the result once and then returns the same totals', async () => {
    const store = new OpeningMasteryStore(new MemoryKeyValueStorage());
    setEphemeralOpeningSession(session());
    const first = await commitOpeningReviewAttempt('review', 'f1', 'p1', 'success', store);
    assert.equal(first.recorded, true);
    assert.equal(first.totalAttempts, 1);
    assert.equal(first.totalSuccesses, 1);
    const second = await commitOpeningReviewAttempt('review', 'f1', 'p1', 'failure', store);
    assert.equal(second.recorded, false);
    assert.equal(second.totalAttempts, 1);
    assert.equal(second.totalSuccesses, 1);
    assert.deepEqual(store.historyFor('f1', 'p1'), ['success']);
  });

  it('does not write Learning / study attempts', async () => {
    const store = new OpeningMasteryStore(new MemoryKeyValueStorage());
    const out = await commitOpeningReviewAttempt('study', 'f1', 'p1', 'success', store);
    assert.equal(out.recorded, false);
    assert.equal(store.historyFor('f1', 'p1').length, 0);
  });

  it('allows a restart to become a new attempt', async () => {
    const store = new OpeningMasteryStore(new MemoryKeyValueStorage());
    setEphemeralOpeningSession(session());
    await commitOpeningReviewAttempt('review', 'f1', 'p1', 'failure', store);
    resetOpeningReviewRecordedFlag();
    const again = await commitOpeningReviewAttempt('review', 'f1', 'p1', 'success', store);
    assert.equal(again.recorded, true);
    assert.equal(again.totalAttempts, 2);
    assert.equal(again.totalSuccesses, 1);
  });
});

describe('Review UI wiring', () => {
  it('play records only on line complete via the shared commit helper', () => {
    const play = read('app/openings/play.tsx');
    assert.match(play, /commitOpeningReviewAttempt/);
    assert.match(play, /presentReviewLineBilan/);
    assert.match(play, /trainingState !== 'lineComplete'/);
    assert.match(play, /origin !== 'review'/);
    assert.doesNotMatch(play, /theoryExit\.kind === 'player-deviation'/);
  });

  it('next line skips the abandon dialog only after lineComplete', () => {
    const screen = read('components/OpeningGameScreen.tsx');
    assert.match(screen, /trainingState === 'lineComplete'/);
    assert.match(screen, /confirmDiscardActivity\('cours'/);
  });

  it('does not auto-reveal a comment after an error', () => {
    const ctx = read('contexts/OpeningGameContext.tsx');
    assert.match(ctx, /kind === 'player-deviation'/);
    assert.match(ctx, /markError/);
    assert.doesNotMatch(
      ctx.slice(ctx.indexOf('if (theoryMsg)'), ctx.indexOf('const showExpectedMove')),
      /resolvedCommentOnReviewedLinePly/,
    );
    assert.match(ctx, /showExpectedMove/);
    assert.match(ctx, /resolvedCommentOnReviewedLinePly/);
  });

  it('hides the final-comment action when there is no comment', () => {
    const panel = read('components/openings/TheoryDecisionPanel.tsx');
    assert.match(panel, /onShowFinalComment/);
    assert.match(panel, /openings\.seeFinalComment/);
    const screen = read('components/OpeningGameScreen.tsx');
    assert.match(screen, /finalLineComment\s*\?/);
  });
});
