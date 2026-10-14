/**
 * Domain tests — comprehension score, theoretical result, selection.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  scoreAttempt,
  averageComprehensionScore,
  summarizeAttempts,
  isThemeMastered,
  formatComprehensionScore,
  formatAverageOrDash,
  headlineFor,
} from '../comprehensionScore.ts';
import { dtmAfterUserMove, dtmOnUserTurn, uciMateToPlies } from '../mateDistance.ts';
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

  it('scores a perfect path as 5 and wasted tempi on the half-point scale', () => {
    const mastered = scoreAttempt({
      outcome: 'success',
      objective: 'WIN',
      userMoves: 3,
      initialMatePlies: 13,
      decisions: [
        { dtmBefore: 5, dtmAfter: 4 },
        { dtmBefore: 3, dtmAfter: 2 },
        { dtmBefore: 1, dtmAfter: 0 },
      ],
    });
    assert.equal(mastered.score, 5);
    assert.equal(mastered.extra, 0);
    const sameDistance = scoreAttempt({
      outcome: 'success',
      objective: 'WIN',
      userMoves: 1,
      initialMatePlies: 5,
      decisions: [{ dtmBefore: 5, dtmAfter: 5 }],
    });
    assert.equal(sameDistance.extra, 1);
    assert.equal(sameDistance.score, 4.5);
    const many = scoreAttempt({
      outcome: 'success',
      objective: 'WIN',
      userMoves: 10,
      decisions: Array.from({ length: 9 }, () => ({ dtmBefore: 5, dtmAfter: 8 })).concat([
        { dtmBefore: 1, dtmAfter: 0 },
      ]),
    });
    assert.equal(many.extra, 18);
    assert.equal(many.score, 1);
    assert.ok(many.score > 0 && many.score < 5);
  });

  it('does not let a facilitating reply cancel tempi the user already lost', () => {
    // Old rule: userMoves 3 versus ceil(11 / 2) = 6 would be extra 0 and 5/5.
    const facilitated = scoreAttempt({
      outcome: 'success',
      objective: 'WIN',
      userMoves: 3,
      initialMatePlies: 11,
      decisions: [
        { dtmBefore: 11, dtmAfter: 12 },
        { dtmBefore: 3, dtmAfter: 4 },
        { dtmBefore: 1, dtmAfter: 0 },
      ],
    });
    assert.equal(facilitated.extra, 2);
    assert.equal(facilitated.score, 4);
    assert.notEqual(facilitated.score, 5);

    const several = scoreAttempt({
      outcome: 'success',
      objective: 'WIN',
      userMoves: 4,
      initialMatePlies: 11,
      decisions: [
        { dtmBefore: 11, dtmAfter: 12 },
        { dtmBefore: 5, dtmAfter: 6 },
        { dtmBefore: 3, dtmAfter: 4 },
        { dtmBefore: 1, dtmAfter: 0 },
      ],
    });
    assert.equal(several.extra, 3);
    assert.equal(several.score, 3.5);
    assert.notEqual(several.score, 5);
  });

  it('accepts two winning methods that keep the distance and ignores the initial target', () => {
    const a = scoreAttempt({
      outcome: 'success',
      objective: 'WIN',
      userMoves: 2,
      initialMatePlies: 99,
      decisions: [
        { dtmBefore: 3, dtmAfter: 2 },
        { dtmBefore: 1, dtmAfter: 0 },
      ],
    });
    const b = scoreAttempt({
      outcome: 'success',
      objective: 'WIN',
      userMoves: 8,
      initialMatePlies: 1,
      decisions: [
        { dtmBefore: 3, dtmAfter: 2 },
        { dtmBefore: 1, dtmAfter: 0 },
      ],
    });
    assert.equal(a.score, 5);
    assert.equal(b.score, 5);
    const longer = scoreAttempt({
      outcome: 'success',
      objective: 'WIN',
      userMoves: 2,
      decisions: [
        { dtmBefore: 3, dtmAfter: 4 },
        { dtmBefore: 3, dtmAfter: 0 },
      ],
    });
    assert.equal(longer.extra, 1);
    assert.equal(longer.score, 4.5);
  });

  it('penalises a recovered loss and leaves a missing distance unevaluated', () => {
    const dipped = scoreAttempt({
      outcome: 'success',
      objective: 'WIN',
      userMoves: 2,
      initialMatePlies: 13,
      decisions: [
        { dtmBefore: 5, dtmAfter: 4, resultAfterReply: 'DRAW' },
        { dtmBefore: 3, dtmAfter: 2, resultAfterReply: 'WIN' },
      ],
    });
    assert.equal(dipped.extra, 4);
    assert.equal(dipped.score, 3.5);
    const missing = scoreAttempt({
      outcome: 'success',
      objective: 'WIN',
      userMoves: 7,
      initialMatePlies: 13,
      decisions: [{ dtmBefore: 13, dtmAfter: null, resultAfterReply: 'WIN' }],
    });
    assert.equal(missing.score, null);
    assert.equal(missing.reason, 'unevaluated');
    assert.match(missing.commentFr, /Qualité non évaluée/);
  });

  it('leaves a success without DTM or mechanism unevaluated', () => {
    const blind = scoreAttempt({ outcome: 'success', objective: 'WIN', userMoves: 4, initialMatePlies: null });
    assert.equal(blind.score, null);
    assert.equal(blind.reason, 'unevaluated');
    assert.match(blind.commentFr, /Qualité non évaluée/);
  });

  it('grades a demonstrated pawn-win path without a mate distance', () => {
    const progress = scoreAttempt({
      outcome: 'success',
      objective: 'WIN',
      userMoves: 8,
      progress: { demonstrated: true, slackMoves: 0 },
    });
    assert.equal(progress.reason, 'progress');
    assert.equal(progress.score, 5);
    const slack = scoreAttempt({
      outcome: 'success',
      objective: 'WIN',
      userMoves: 8,
      progress: { demonstrated: true, slackMoves: 2 },
    });
    assert.equal(slack.score, 4);
    assert.ok((slack.score ?? 0) < (progress.score ?? 0));
  });

  it('grades a demonstrated draw and does not punish an unmeasured method', () => {
    const held = scoreAttempt({
      outcome: 'success',
      objective: 'DRAW',
      userMoves: 6,
      initialMatePlies: null,
      mechanism: { demonstrated: true, slackMoves: 1 },
    });
    assert.equal(held.score, 4.5);
    const alternative = scoreAttempt({
      outcome: 'success',
      objective: 'DRAW',
      userMoves: 2,
      mechanism: { demonstrated: true, slackMoves: 0 },
    });
    assert.equal(alternative.reason, 'mechanism');
    assert.equal(alternative.score, 5);
    const unknown = scoreAttempt({
      outcome: 'success',
      objective: 'DRAW',
      userMoves: 3,
      initialMatePlies: null,
      mechanism: { demonstrated: false, slackMoves: 0 },
    });
    assert.equal(unknown.reason, 'unevaluated');
    assert.equal(unknown.score, null);
    assert.match(unknown.commentFr, /Qualité non évaluée/);
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
    assert.equal(
      headlineFor({ score: null, outcome: 'success', objective: 'WIN', lang: 'fr' }),
      'Finale gagnée !',
    );
    assert.equal(
      headlineFor({ score: null, outcome: 'success', objective: 'DRAW', lang: 'en' }),
      'Defence held!',
    );
  });

  it('formats the current scale on 5', () => {
    assert.equal(formatComprehensionScore(4), '4/5');
    assert.match(formatComprehensionScore(3.5), /3,5\/5/);
    assert.equal(formatComprehensionScore(0), '0/5');
    assert.equal(formatAverageOrDash(0, 0), '—/5');
    assert.equal(formatAverageOrDash(1, 0), '0/5');
  });

  it('keeps an unscored win in the attempt count and out of the average', () => {
    const summary = summarizeAttempts([
      { outcome: 'success', scoreScale: 'quality-5', attemptScore: null, analysisStatus: 'pending' },
      { outcome: 'success', scoreScale: 'quality-5', attemptScore: 4, gradeConfidence: 'estimated' },
      { outcome: 'theoretical-loss', scoreScale: 'quality-5', attemptScore: 0, gradeConfidence: 'exact' },
      { outcome: 'abandoned', scoreScale: 'quality-5', attemptScore: null },
      { outcome: 'interrupted', scoreScale: 'quality-5', attemptScore: null },
      { outcome: 'success', scoreScale: 'legacy-10', attemptScore: 10 },
    ]);
    assert.equal(summary.attemptCount, 3);
    assert.equal(summary.winCount, 2);
    assert.equal(summary.pendingCount, 1);
    assert.equal(summary.count, 2);
    assert.equal(summary.score, 2);
    assert.equal(summary.estimatedCount, 0);
    assert.equal(summary.estimatedScore, 0);
  });

  it('averages 5, 4, 3, 2 and 0 as 2.8 on one scale', () => {
    const summary = summarizeAttempts([
      { outcome: 'success', scoreScale: 'quality-5', attemptScore: 5, gradeConfidence: 'exact' },
      { outcome: 'success', scoreScale: 'quality-5', attemptScore: 4, gradeConfidence: 'estimated' },
      { outcome: 'success', scoreScale: 'quality-5', attemptScore: 3, gradeConfidence: 'exact' },
      { outcome: 'success', scoreScale: 'quality-5', attemptScore: 2, gradeConfidence: 'estimated' },
      { outcome: 'theoretical-loss', scoreScale: 'quality-5', attemptScore: 0, gradeConfidence: 'exact' },
    ]);
    assert.equal(summary.count, 5);
    assert.equal(summary.score, 2.8);
    assert.equal(summary.winCount, 4);
    assert.equal(formatComprehensionScore(summary.score), '2,8/5');
  });

  it('does not snap a mean to the nearest half-point', () => {
    const summary = summarizeAttempts([
      { outcome: 'success', scoreScale: 'quality-5', attemptScore: 5 },
      { outcome: 'success', scoreScale: 'quality-5', attemptScore: 5 },
      { outcome: 'success', scoreScale: 'quality-5', attemptScore: 4 },
    ]);
    assert.equal(summary.score, 4.7);
  });

  it('counts a defensive success and every stored grade, including a real zero', () => {
    const grades = [
      ...Array.from({ length: 10 }, () => ({
        outcome: 'success' as const,
        scoreScale: 'quality-5' as const,
        attemptScore: 5,
      })),
      { outcome: 'success' as const, scoreScale: 'quality-5' as const, attemptScore: 0, objective: 'DRAW' },
    ];
    const summary = summarizeAttempts(grades);
    assert.equal(summary.count, 11);
    assert.equal(summary.winCount, 11);
    assert.equal(summary.score, 4.5);
    const missing = summarizeAttempts([
      { outcome: 'success', scoreScale: 'quality-5', attemptScore: null, analysisStatus: 'pending' },
    ]);
    assert.equal(missing.count, 0);
    assert.equal(missing.score, 0);
    assert.equal(formatAverageOrDash(missing.count, missing.score), '—/5');
  });

  it('keeps the result title free of the grade', () => {
    assert.equal(
      headlineFor({ score: 4.5, outcome: 'success', objective: 'WIN', lang: 'fr' }),
      'Finale gagnée !',
    );
    assert.equal(
      headlineFor({ score: 0, outcome: 'theoretical-loss', objective: 'WIN', lang: 'fr' }),
      'Objectif échoué',
    );
    assert.equal(
      headlineFor({ score: 5, outcome: 'success', objective: 'DRAW', lang: 'fr' }),
      'Défense réussie !',
    );
  });

  it('converts UCI mate moves into plies', () => {
    assert.equal(uciMateToPlies(1), 1);
    assert.equal(uciMateToPlies(4), 7);
    assert.equal(uciMateToPlies(-1), 2);
    assert.equal(uciMateToPlies(-3), 6);
    assert.equal(dtmOnUserTurn(3), 5);
    assert.equal(dtmAfterUserMove(-6), 12);
    assert.equal(dtmOnUserTurn(0), null);
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

  it('keeps category, DTZ, DTM and source apart for every variant', () => {
    for (const p of THEORETICAL_ENDGAME_POOL) {
      const proof = p.proof;
      assert.ok(proof.method === 'syzygy-7' || proof.method === 'stockfish-18-lite-depth-16', p.id);
      assert.ok(proof.source === 'lichess-syzygy' || proof.source === 'stockfish-18-lite', p.id);
      assert.ok(proof.category === 'win' || proof.category === 'draw' || proof.category === 'loss', p.id);
      assert.ok(proof.dtz === null || typeof proof.dtz === 'number', p.id);
      assert.ok(proof.dtm === null || typeof proof.dtm === 'number', p.id);
      assert.equal(proof.playerResult, proof.category.toUpperCase(), p.id);
      if (proof.confidence === 'exact' && proof.category === 'win') {
        assert.ok(proof.dtm != null && proof.dtm > 0, p.id);
        assert.equal(proof.dtmReported, proof.dtm, p.id);
        assert.equal(proof.source, 'lichess-syzygy', p.id);
      }
      if (proof.confidence === 'exact' && proof.category === 'draw') {
        assert.equal(proof.dtm, null, p.id);
        assert.equal(proof.dtmReported, 0, p.id);
        assert.equal(proof.dtz, 0, p.id);
      }
      if (proof.confidence === 'engine') {
        assert.equal(proof.dtm, null, p.id);
        assert.equal(proof.dtmReported, null, p.id);
        assert.equal(proof.source, 'stockfish-18-lite', p.id);
        assert.equal(typeof proof.centipawn, 'number', true, p.id);
      }
    }
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
