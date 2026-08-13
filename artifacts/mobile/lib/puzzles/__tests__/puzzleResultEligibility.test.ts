/**
 * Tactics Pass 3 — indices, streak eligibility, result states, rating bands.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { filterBoardPieces } from '../boardDisplay.ts';
import {
  PUZZLE_RATING_BANDS,
  PUZZLE_RATING_BANDS_SELECTABLE,
  PUZZLE_RATING_BAND_ALL,
  getPuzzleRatingBand,
} from '../puzzleBands.ts';
import {
  countPuzzleIndices,
  isAssistedPuzzleSolve,
  isCleanPuzzleSolve,
  puzzleResultState,
  puzzleResultTitle,
} from '../puzzleResultEligibility.ts';
import {
  emptyPuzzleStats,
  finalizePuzzleStats,
  type PuzzleAttemptStats,
} from '../types.ts';
import { Chess } from 'chess.js';

const here = dirname(fileURLToPath(import.meta.url));
const componentsDir = join(here, '../../../components/puzzles');

function cleanStats(overrides: Partial<PuzzleAttemptStats> = {}): PuzzleAttemptStats {
  const base = emptyPuzzleStats(2);
  base.solved = true;
  base.correctOnFirstAttempt = 2;
  base.userMoveCount = 2;
  return finalizePuzzleStats({ ...base, ...overrides });
}

describe('puzzle rating DiscreteSlider bands', () => {
  it('exposes exactly one selectable stop per concrete Elo band', () => {
    assert.equal(PUZZLE_RATING_BANDS_SELECTABLE.length, 9);
    assert.ok(PUZZLE_RATING_BANDS_SELECTABLE.every((b) => b.id !== 'all'));
    assert.equal(PUZZLE_RATING_BANDS_SELECTABLE[0]!.label, '600–799');
    assert.equal(
      PUZZLE_RATING_BANDS_SELECTABLE[PUZZLE_RATING_BANDS_SELECTABLE.length - 1]!.label,
      '2200+',
    );
  });

  it('keeps Aléatoire / Tous as a separate explicit option', () => {
    assert.equal(PUZZLE_RATING_BAND_ALL.id, 'all');
    assert.ok(PUZZLE_RATING_BANDS.some((b) => b.id === 'all'));
    const all = getPuzzleRatingBand('all');
    assert.equal(all.ratingMin, 0);
    assert.equal(all.ratingMax, 4000);
  });

  it('maps slider indices only to valid discrete band ids', () => {
    for (let i = 0; i < PUZZLE_RATING_BANDS_SELECTABLE.length; i++) {
      const band = PUZZLE_RATING_BANDS_SELECTABLE[i]!;
      assert.equal(typeof band.id, 'string');
      assert.ok(Number.isInteger(band.ratingMin));
      assert.ok(Number.isInteger(band.ratingMax));
      assert.ok(band.ratingMin <= band.ratingMax);
    }
  });
});

describe('puzzle index counting', () => {
  it('counts Coup suivant each use and piece reveals once', () => {
    const helps = emptyPuzzleStats().helps;
    assert.equal(countPuzzleIndices(helps, 0), 0);
    helps.whiteReveal = true;
    assert.equal(countPuzzleIndices(helps, 0), 1);
    helps.whiteReveal = true; // still once
    assert.equal(countPuzzleIndices(helps, 0), 1);
    helps.blackReveal = true;
    assert.equal(countPuzzleIndices(helps, 0), 2);
    assert.equal(countPuzzleIndices(helps, 2), 4);
  });

  it('does not count position repeat as an index', () => {
    const helps = emptyPuzzleStats().helps;
    helps.positionRepeat = true;
    assert.equal(countPuzzleIndices(helps, 0), 0);
    const stats = cleanStats({
      helps: { ...helps },
      nextMoveUses: 0,
    });
    assert.equal(isCleanPuzzleSolve(stats), true);
  });
});

describe('puzzle streak / result eligibility', () => {
  it('clean solve increments-eligible and titles Problème résolu', () => {
    const stats = cleanStats();
    assert.equal(isCleanPuzzleSolve(stats), true);
    assert.equal(puzzleResultState(stats), 'solved');
    assert.equal(puzzleResultTitle('solved'), 'Problème résolu');
  });

  it('Coup suivant solve is assisted — not streak-clean', () => {
    const helps = emptyPuzzleStats().helps;
    helps.nextMove = true;
    const stats = cleanStats({ helps, nextMoveUses: 1 });
    assert.equal(isCleanPuzzleSolve(stats), false);
    assert.equal(isAssistedPuzzleSolve(stats), true);
    assert.equal(puzzleResultState(stats), 'solved-with-help');
    assert.equal(puzzleResultTitle('solved-with-help'), 'Problème résolu avec aide');
    assert.equal(countPuzzleIndices(stats.helps, stats.nextMoveUses), 1);
  });

  it('mistake voids clean solve even without indices', () => {
    const stats = cleanStats({
      wrongChessMoves: 1,
      correctOnFirstAttempt: 1,
    });
    assert.equal(isCleanPuzzleSolve(stats), false);
    assert.equal(puzzleResultState(stats), 'solved-with-help');
  });

  it('full solution is unsolved — never 100% clean', () => {
    const stats = finalizePuzzleStats({
      ...emptyPuzzleStats(2),
      solved: false,
      solutionRequested: true,
      helps: { ...emptyPuzzleStats().helps, solution: true },
      nextMoveUses: 0,
    });
    assert.equal(puzzleResultState(stats), 'unsolved');
    assert.equal(puzzleResultTitle('unsolved'), 'Problème non résolu');
    assert.equal(isCleanPuzzleSolve(stats), false);
  });
});

describe('blind board piece reveal filtering', () => {
  it('supports white-only, black-only, both, and hidden', () => {
    const board = new Chess().board() as ({ type: string; color: 'w' | 'b' } | null)[][];
    const white = filterBoardPieces(board, 'white').flat().filter(Boolean);
    const black = filterBoardPieces(board, 'black').flat().filter(Boolean);
    const hidden = filterBoardPieces(board, 'hidden').flat().filter(Boolean);
    const all = filterBoardPieces(board, 'all').flat().filter(Boolean);
    assert.ok(white.every((p) => p!.color === 'w'));
    assert.ok(black.every((p) => p!.color === 'b'));
    assert.equal(hidden.length, 0);
    assert.ok(all.length > white.length);
    assert.ok(all.length > black.length);
  });
});

describe('puzzle UX opt-ins', () => {
  it('opts visual and results boards into wide sizing', () => {
    for (const file of ['PuzzlePlayingPhase.tsx', 'PuzzleResultsPhase.tsx']) {
      const src = readFileSync(join(componentsDir, file), 'utf8');
      assert.match(src, /useBoardSize\('wide'\)/);
      assert.match(src, /sizeMode=["']wide["']/);
    }
  });

  it('keeps microphone on visual and blind playing UI', () => {
    const src = readFileSync(join(componentsDir, 'PuzzlePlayingPhase.tsx'), 'utf8');
    assert.match(src, /GameMicButton/);
    assert.match(src, /puzzle-visual-mic/);
    assert.match(src, /puzzle-blind-mic/);
  });

  it('does not reserve HiddenBoardPlaceholder in blind playing UI', () => {
    const src = readFileSync(join(componentsDir, 'PuzzlePlayingPhase.tsx'), 'utf8');
    assert.doesNotMatch(src, /HiddenBoardPlaceholder/);
    assert.match(src, /puzzle-blind-board/);
  });

  it('uses DiscreteSlider via PuzzleRatingBandSlider on mode settings', () => {
    const settings = readFileSync(join(componentsDir, 'PuzzleSettingsPhase.tsx'), 'utf8');
    const slider = readFileSync(join(componentsDir, 'PuzzleRatingBandSlider.tsx'), 'utf8');
    assert.match(settings, /PuzzleRatingBandSlider/);
    assert.match(settings, /puzzle\.randomAll/);
    assert.match(slider, /DiscreteSlider/);
    assert.match(slider, /PUZZLE_RATING_BANDS_SELECTABLE/);
  });
});
