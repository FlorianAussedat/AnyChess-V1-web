/**
 * Domain tests — comprehension score, theoretical result, selection.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  scoreAttempt,
  averageComprehensionScore,
  isThemeMastered,
  formatComprehensionScore,
} from '../comprehensionScore.ts';
import {
  lostTheoreticalObjective,
  wdlToPlayerResult,
} from '../theoreticalResult.ts';
import {
  pickPositionInTheme,
  pickRandomFromActiveThemes,
  listByTheme,
  listPool,
} from '../../selection/selectors.ts';
import { THEORETICAL_ENDGAME_POOL } from '../../data/pool.generated.ts';
import { THEME_IDS } from '../themes.ts';
import { flipColors, mirrorHorizontal, isTransformSafe } from '../../transforms/fenTransforms.ts';
import { Chess } from 'chess.js';

describe('comprehension score', () => {
  it('scores failure as 0', () => {
    assert.equal(scoreAttempt({ outcome: 'theoretical-loss', userMoves: 5, targetUserMoves: 8 }), 0);
  });

  it('scores fast success as 10', () => {
    assert.equal(scoreAttempt({ outcome: 'success', userMoves: 8, targetUserMoves: 10 }), 10);
  });

  it('scores slow success as 7', () => {
    assert.equal(scoreAttempt({ outcome: 'success', userMoves: 16, targetUserMoves: 10 }), 7);
  });

  it('averages last attempts and ignores abandon', () => {
    const avg = averageComprehensionScore([
      { outcome: 'success', userMoves: 10, targetUserMoves: 10, attemptScore: 10 },
      { outcome: 'abandoned', userMoves: 0, targetUserMoves: 10 },
      { outcome: 'theoretical-loss', userMoves: 4, targetUserMoves: 10, attemptScore: 0 },
    ]);
    assert.equal(avg.count, 2);
    assert.equal(avg.score, 5);
  });

  it('mastered at 10', () => {
    assert.equal(isThemeMastered(10), true);
    assert.equal(isThemeMastered(9.9), false);
  });

  it('formats score', () => {
    assert.equal(formatComprehensionScore(9), '9/10');
    assert.match(formatComprehensionScore(7.4), /7,4\/10/);
  });
});

describe('theoretical result', () => {
  it('detects loss of win objective', () => {
    assert.equal(lostTheoreticalObjective('WIN', 'DRAW'), true);
    assert.equal(lostTheoreticalObjective('WIN', 'WIN'), false);
  });

  it('detects loss of draw objective', () => {
    assert.equal(lostTheoreticalObjective('DRAW', 'LOSS'), true);
    assert.equal(lostTheoreticalObjective('DRAW', 'DRAW'), false);
  });

  it('converts WDL for player', () => {
    const r = wdlToPlayerResult({ win: 50, draw: 900, loss: 50 }, 'w', 'white');
    assert.equal(r, 'DRAW');
  });
});

describe('pool integrity', () => {
  it('has exactly 10 active positions', () => {
    assert.equal(listPool().length, 10);
    assert.equal(THEORETICAL_ENDGAME_POOL.length, 10);
  });

  it('covers all mandatory themes once', () => {
    for (const id of THEME_IDS) {
      assert.equal(listByTheme(id).length, 1, id);
    }
  });

  it('has unique ids and FENs', () => {
    const ids = new Set(THEORETICAL_ENDGAME_POOL.map((p) => p.id));
    assert.equal(ids.size, THEORETICAL_ENDGAME_POOL.length);
    const fens = new Set(
      THEORETICAL_ENDGAME_POOL.map((p) => p.initialFen.split(' ').slice(0, 4).join(' ')),
    );
    assert.equal(fens.size, THEORETICAL_ENDGAME_POOL.length);
  });

  it('majority WIN objectives', () => {
    const wins = THEORETICAL_ENDGAME_POOL.filter((p) => p.objective === 'WIN').length;
    assert.ok(wins > THEORETICAL_ENDGAME_POOL.length / 2);
  });

  it('all FENs are legal', () => {
    for (const p of THEORETICAL_ENDGAME_POOL) {
      assert.doesNotThrow(() => new Chess(p.initialFen), p.id);
    }
  });
});

describe('fen transforms', () => {
  it('flipColors preserves legality for safe positions', () => {
    const fen = '8/8/8/4k3/8/8/8/4K2Q w - - 0 1';
    assert.ok(isTransformSafe(fen));
    const flipped = flipColors(fen);
    assert.doesNotThrow(() => new Chess(flipped));
    assert.equal(flipped.split(' ')[1], 'b');
  });

  it('mirrorHorizontal keeps legal FEN', () => {
    const fen = '8/8/8/4k3/8/8/8/4K2Q w - - 0 1';
    const mirrored = mirrorHorizontal(fen);
    assert.doesNotThrow(() => new Chess(mirrored));
  });

  it('rejects flip when en passant present', () => {
    assert.throws(() => flipColors('8/8/8/8/3pP3/8/8/8 w - e3 0 1'));
  });
});

describe('selection', () => {
  it('replays same position when theme has one entry', () => {
    const themeId = 'queen-mate';
    const first = pickPositionInTheme(themeId, null)!;
    const second = pickPositionInTheme(themeId, first.id)!;
    assert.equal(first.id, second.id);
  });

  it('random picks from non-mastered themes', () => {
    const themeAttempts: Record<string, { attempts: [] }> = {};
    for (const id of THEME_IDS) themeAttempts[id] = { attempts: [] };
    const pick = pickRandomFromActiveThemes(themeAttempts, null);
    assert.ok(pick?.position);
  });
});
