import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getPositionById } from '../../selection/selectors.ts';
import { assessPawnWin, breakMoveAmong, pickPawnWinUserSan } from '../pawnWinProgress.ts';
import { gradeQuality } from '../comprehensionScore.ts';

describe('pawn-win progress', () => {
  it('picks the classical b6 break instead of a waiting king move', () => {
    const position = getPositionById('TE-CANON-PAWN-BREAKTHROUGH');
    assert.ok(position);
    const legal = breakMoveAmong(['Ke2', 'b6', 'a6', 'c6']);
    assert.equal(legal, 'b6');
    const san = pickPawnWinUserSan({
      themeId: position!.themeId,
      initialFen: position!.initialFen,
      sans: [],
      playerColor: position!.playerColor,
      objective: 'WIN',
    });
    assert.equal(san, 'b6');
  });

  it('grades a winning promotion without using a mate score', () => {
    const position = getPositionById('TE-CANON-KPK');
    assert.ok(position);
    const sans = [
      'Ke3', 'Kd5', 'Kf4', 'Ke6', 'Ke4', 'Kd6', 'Kf5', 'Ke7', 'Ke5', 'Kd7', 'Kf6', 'Kd6',
      'e4', 'Kd7', 'e5', 'Ke8', 'Ke6', 'Kd8', 'Kf7', 'Kc7', 'e6', 'Kd6', 'e7', 'Kc7',
      'e8=Q', 'Kb6', 'Qe5', 'Kb7', 'Qc5', 'Ka6', 'Kf6', 'Kb7', 'Ke6', 'Ka6', 'Kd5', 'Kb7',
      'Qc6+', 'Kb8', 'Qd7', 'Ka8', 'Kc6', 'Kb8', 'Qb7#',
    ];
    const progress = assessPawnWin({
      themeId: 'kp-vs-k',
      initialFen: position!.initialFen,
      sans,
      playerColor: 'white',
      objective: 'WIN',
    });
    assert.equal(progress.demonstrated, true);
    assert.equal(progress.winningPromotion, true);
    const grade = gradeQuality({
      outcome: 'success',
      objective: 'WIN',
      userMoves: 22,
      progress: { demonstrated: true, slackMoves: progress.slackMoves },
    });
    assert.equal(grade.reason, 'progress');
    assert.equal(grade.score, 5);
    assert.ok((progress.slackMoves ?? 99) <= 1);
  });

  it('does not count getting out of check as Lucena slack', () => {
    const position = getPositionById('TE-CANON-LUCENA-2');
    assert.ok(position);
    const sans = [
      'Kf7',
      'Rf2+',
      'Ke6',
      'Kg7',
      'e8=Q',
      'Rf6+',
      'Kd5',
      'Rf5+',
      'Ke4',
      'Rg5',
      'Qd7+',
      'Kg8',
      'Qd8+',
      'Kf7',
      'Qxg5',
      'Ke6',
      'Kd4+',
      'Kd7',
      'Re7+',
      'Kd8',
      'Qf6',
      'Kc8',
      'Qh8#',
    ];
    const progress = assessPawnWin({
      themeId: 'lucena',
      initialFen: position!.initialFen,
      sans,
      playerColor: 'white',
      objective: 'WIN',
    });
    assert.equal(progress.demonstrated, true);
    assert.equal(progress.slackMoves, 0);
  });

  it('treats the queen approaching the enemy pawn as progress, not a detour', () => {
    const position = getPositionById('TE-CANON-QUEEN-PAWN-1');
    assert.ok(position);
    const efficient = assessPawnWin({
      themeId: 'queen-vs-pawn',
      initialFen: position!.initialFen,
      sans: [
        'Qa8',
        'Kb5',
        'Qb7+',
        'Ka4',
        'Qxc7',
        'Ka3',
        'Qc3+',
        'Ka2',
        'Kg3',
        'Kb1',
        'Qd2',
        'Ka1',
        'Kf4',
        'Kb1',
        'Ke4',
        'Ka1',
        'Kd3',
        'Kb1',
        'Kc3',
        'Ka1',
        'Qb2#',
      ],
      playerColor: 'black',
      objective: 'WIN',
    });
    const detour = assessPawnWin({
      themeId: 'queen-vs-pawn',
      initialFen: position!.initialFen,
      sans: [
        'Qa8',
        'Kb5',
        'Qh1',
        'Ka6',
        'Qa8',
        'Kb5',
        'Qb7+',
        'Ka4',
        'Qxc7',
        'Ka3',
        'Qc3+',
        'Ka2',
        'Kg3',
        'Kb1',
        'Qd2',
        'Ka1',
        'Kf4',
        'Kb1',
        'Ke4',
        'Ka1',
        'Kd3',
        'Kb1',
        'Kc3',
        'Ka1',
        'Qb2#',
      ],
      playerColor: 'black',
      objective: 'WIN',
    });
    assert.equal(efficient.demonstrated, true);
    assert.ok(efficient.slackMoves < detour.slackMoves);
  });

  it('does not treat a simple centipawn-like king wander after promotion as extra slack', () => {
    const position = getPositionById('TE-CANON-ROOK-PAWN-WIN');
    assert.ok(position);
    const sans = [
      'a7', 'Kd8', 'a8=Q+', 'Kd7', 'Qb7+', 'Ke8', 'Kc5', 'Kf8', 'Kb4', 'Kg8', 'Qd7', 'Kf8',
      'Kc5', 'Kg8', 'Qe7', 'Kh8', 'Kd4', 'Kg8', 'Ke5', 'Kh8', 'Kf6', 'Kg8', 'Qg7#',
    ];
    const progress = assessPawnWin({
      themeId: 'rook-pawn',
      initialFen: position!.initialFen,
      sans,
      playerColor: 'white',
      objective: 'WIN',
    });
    assert.equal(progress.winningPromotion, true);
    assert.equal(progress.slackMoves, 0);
  });
});
