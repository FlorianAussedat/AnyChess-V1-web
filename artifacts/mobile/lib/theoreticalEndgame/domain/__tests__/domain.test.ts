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
  headlineFor,
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
  it('scores failure as 0 and abandon as no grade', () => {
    const lost = scoreAttempt({ outcome: 'theoretical-loss', objective: 'WIN', userMoves: 5, initialMatePlies: 8 });
    assert.equal(lost.score, 0);
    const left = scoreAttempt({ outcome: 'abandoned', objective: 'WIN', userMoves: 5, initialMatePlies: 8 });
    assert.equal(left.score, null);
    const stopped = scoreAttempt({ outcome: 'interrupted', objective: 'DRAW', userMoves: 80, initialMatePlies: null });
    assert.equal(stopped.score, null);
  });

  it('scores an exact mate distance as 5 and detours on the half-point scale', () => {
    const mastered = scoreAttempt({ outcome: 'success', objective: 'WIN', userMoves: 7, initialMatePlies: 13 });
    assert.equal(mastered.score, 5);
    assert.equal(mastered.extra, 0);
    const small = scoreAttempt({ outcome: 'success', objective: 'WIN', userMoves: 8, initialMatePlies: 13 });
    assert.equal(small.score, 4.5);
    const many = scoreAttempt({ outcome: 'success', objective: 'WIN', userMoves: 19, initialMatePlies: 13 });
    assert.equal(many.score, 2);
    assert.ok(many.score! > 0 && many.score! < 5);
  });

  it('accepts two winning methods and ignores time and any old target', () => {
    const a = scoreAttempt({ outcome: 'success', objective: 'WIN', userMoves: 7, initialMatePlies: 13 });
    const b = scoreAttempt({ outcome: 'success', objective: 'WIN', userMoves: 7, initialMatePlies: 13 });
    assert.deepEqual(a, b);
    const longer = scoreAttempt({ outcome: 'success', objective: 'WIN', userMoves: 9, initialMatePlies: 13 });
    assert.equal(longer.score, 4);
  });

  it('penalises a recovered loss without treating a missing trace as unevaluated', () => {
    const dipped = scoreAttempt({
      outcome: 'success',
      objective: 'WIN',
      userMoves: 7,
      initialMatePlies: 13,
      decisions: [
        { resultAfterReply: 'DRAW' },
        { resultAfterReply: 'WIN' },
      ],
    });
    assert.equal(dipped.extra, 4);
    assert.equal(dipped.score, 3.5);
    const missing = scoreAttempt({
      outcome: 'success',
      objective: 'WIN',
      userMoves: 7,
      initialMatePlies: 13,
      decisions: [{ resultAfterReply: null }],
    });
    assert.equal(missing.score, 5);
  });

  it('leaves a success without DTM or mechanism unevaluated', () => {
    const blind = scoreAttempt({ outcome: 'success', objective: 'WIN', userMoves: 4, initialMatePlies: null });
    assert.equal(blind.score, null);
    assert.equal(blind.reason, 'unevaluated');
    assert.match(blind.commentFr, /Qualité non évaluée/);
  });

  it('grades a demonstrated draw and a draw that skips the mechanism', () => {
    const held = scoreAttempt({
      outcome: 'success',
      objective: 'DRAW',
      userMoves: 6,
      initialMatePlies: null,
      mechanism: { demonstrated: true, slackMoves: 1 },
    });
    assert.equal(held.score, 4.5);
    const fragile = scoreAttempt({
      outcome: 'success',
      objective: 'DRAW',
      userMoves: 3,
      initialMatePlies: null,
      mechanism: { demonstrated: false, slackMoves: 0 },
    });
    assert.equal(fragile.reason, 'draw-without-mechanism');
    assert.equal(fragile.score, 2);
  });

  it('averages only the current scale and keeps legacy scores apart', () => {
    const avg = averageComprehensionScore([
      { outcome: 'success', scoreScale: 'quality-5', attemptScore: 5 },
      { outcome: 'abandoned', scoreScale: 'quality-5', attemptScore: null },
      { outcome: 'theoretical-loss', scoreScale: 'quality-5', attemptScore: 0 },
      { outcome: 'success', scoreScale: 'legacy-10', attemptScore: 10 },
    ]);
    assert.equal(avg.count, 2);
    assert.equal(avg.score, 2.5);
  });

  it('mastered at 5 on the current scale', () => {
    assert.equal(isThemeMastered(5), true);
    assert.equal(isThemeMastered(4.5), false);
  });

  it('does not call an interruption a failed objective', () => {
    assert.equal(
      headlineFor({ score: null, outcome: 'interrupted', objective: 'DRAW', lang: 'fr' }),
      'Tentative interrompue, sans note',
    );
    assert.match(
      headlineFor({ score: null, outcome: 'success', objective: 'WIN', lang: 'fr' }),
      /Qualité non évaluée — Finale gagnée/,
    );
  });

  it('formats the current scale on 5', () => {
    assert.equal(formatComprehensionScore(4), '4/5');
    assert.match(formatComprehensionScore(3.5), /3,5\/5/);
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
  it('has 57 active positions and does not weight a theme by its variant count', () => {
    assert.equal(listPool().length, 57);
    assert.equal(THEORETICAL_ENDGAME_POOL.length, 57);
    assert.equal(THEME_IDS.length, 18);
  });

  it('gives every theme at least three variants, and the pawn square six', () => {
    for (const id of THEME_IDS) {
      const n = listByTheme(id).length;
      assert.ok(n >= (id === 'pawn-square' ? 6 : 3), id);
    }
    const square = listByTheme('pawn-square');
    assert.equal(square.filter((p) => p.objective === 'WIN').length, 3);
    assert.equal(square.filter((p) => p.objective === 'DRAW').length, 3);
  });

  it('has unique ids and FENs', () => {
    const ids = new Set(THEORETICAL_ENDGAME_POOL.map((p) => p.id));
    assert.equal(ids.size, THEORETICAL_ENDGAME_POOL.length);
    const fens = new Set(
      THEORETICAL_ENDGAME_POOL.map((p) => p.initialFen.split(' ').slice(0, 4).join(' ')),
    );
    assert.equal(fens.size, THEORETICAL_ENDGAME_POOL.length);
  });

  it('gives the user the move, both colours, and no stored target', () => {
    const colors = new Set<string>();
    for (const p of THEORETICAL_ENDGAME_POOL) {
      const stm = p.initialFen.split(' ')[1] === 'b' ? 'black' : 'white';
      assert.equal(p.playerColor, stm, p.id);
      assert.equal(p.diagramOrientation, p.playerColor, p.id);
      assert.equal('targetUserMoves' in p, false, p.id);
      colors.add(p.playerColor);
      assert.ok(p.explanation.fr.principle && p.explanation.en.principle, p.id);
    }
    assert.equal(colors.size, 2);
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
  it('does not repeat the previous variant when another exists', () => {
    const themeId = 'queen-mate';
    const first = pickPositionInTheme(themeId, null, () => 0)!;
    const second = pickPositionInTheme(themeId, first.id, () => 0)!;
    assert.notEqual(first.id, second.id);
    assert.equal(second.themeId, themeId);
  });

  it('random picks from non-mastered themes', () => {
    const themeAttempts: Record<string, { attempts: [] }> = {};
    for (const id of THEME_IDS) themeAttempts[id] = { attempts: [] };
    const pick = pickRandomFromActiveThemes(themeAttempts, null);
    assert.ok(pick?.position);
  });
});
