import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assessMateDrive } from '../mateDrive.ts';
import { gradeQuality } from '../comprehensionScore.ts';
import { getPositionById } from '../../selection/selectors.ts';

function scoreOf(drive: { demonstrated: boolean; slackMoves: number }, userMoves: number): number | null {
  return gradeQuality({
    outcome: 'success',
    objective: 'WIN',
    userMoves,
    progress: { demonstrated: drive.demonstrated, slackMoves: drive.slackMoves },
  }).score;
}

describe('elementary-mate drive', () => {
  it('scores a mate in one on the edge without a DTM', () => {
    const drive = assessMateDrive({
      initialFen: '7k/5K2/8/8/8/8/8/6Q1 w - - 0 1',
      sans: ['Qg7#'],
      playerColor: 'white',
    });
    assert.equal(drive.demonstrated, true);
    assert.equal(drive.slackMoves, 0);
    const grade = gradeQuality({
      outcome: 'success',
      objective: 'WIN',
      userMoves: 1,
      progress: { demonstrated: true, slackMoves: 0 },
    });
    assert.equal(grade.reason, 'progress');
    assert.equal(grade.score, 5);
  });

  it('counts a missed mate-in-one as slack even if the queen gets closer', () => {
    const fen = '7k/5K2/8/8/8/8/8/6Q1 w - - 0 1';
    const efficient = assessMateDrive({ initialFen: fen, sans: ['Qg7#'], playerColor: 'white' });
    const detour = assessMateDrive({
      initialFen: fen,
      sans: ['Qg2', 'Kh7', 'Qg7#'],
      playerColor: 'white',
    });
    assert.equal(efficient.slackMoves, 0);
    assert.ok(detour.slackMoves >= 1);
    assert.ok((scoreOf(efficient, 1) ?? 0) > (scoreOf(detour, 2) ?? 5));
  });

  it('ranks the KRK opposition walk above a shorter diagonal rush', () => {
    const position = getPositionById('TE-CANON-ROOK-MATE-2');
    assert.ok(position);
    const efficient = assessMateDrive({
      initialFen: position!.initialFen,
      sans: ['Rg1', 'Kh7', 'Ke3', 'Kh8', 'Kf4', 'Kh7', 'Rg2', 'Kh8', 'Kf5', 'Kh7', 'Kf6', 'Kh8', 'Kf7', 'Kh7', 'Rh2#'],
      playerColor: 'white',
    });
    const detour = assessMateDrive({
      initialFen: position!.initialFen,
      sans: ['Rg1', 'Kh7', 'Ke4', 'Kh8', 'Kf5', 'Kh7', 'Rg2', 'Kh8', 'Kf6', 'Kh7', 'Kf7', 'Kh8', 'Rh2#'],
      playerColor: 'white',
    });
    assert.equal(efficient.demonstrated, true);
    assert.equal(detour.demonstrated, true);
    assert.ok(
      (scoreOf(efficient, 8) ?? 0) > (scoreOf(detour, 7) ?? 5),
      `efficient=${scoreOf(efficient, 8)} slack=${efficient.slackMoves} detour=${scoreOf(detour, 7)} slack=${detour.slackMoves}`,
    );
  });

  it('keeps a two-bishops mate on the edge as demonstrated', () => {
    const drive = assessMateDrive({
      initialFen: '6k1/8/5K2/8/8/8/5BB1/8 w - - 0 1',
      sans: ['Be4', 'Kh8', 'Bd5', 'Kh7', 'Be3', 'Kh8', 'Kf7', 'Kh7', 'Be4+', 'Kh8', 'Bd4#'],
      playerColor: 'white',
    });
    assert.equal(drive.demonstrated, true);
    assert.ok(drive.complete);
  });

  it('ranks a short two-bishops mate above the same mate with extra bishop wanders', () => {
    const fen = '6k1/8/5K2/8/8/8/5BB1/8 w - - 0 1';
    const efficient = assessMateDrive({
      initialFen: fen,
      sans: ['Be4', 'Kh8', 'Bd5', 'Kh7', 'Be3', 'Kh8', 'Kf7', 'Kh7', 'Be4+', 'Kh8', 'Bd4#'],
      playerColor: 'white',
    });
    const detour = assessMateDrive({
      initialFen: fen,
      sans: ['Bh3', 'Kh8', 'Bg2', 'Kg8', 'Be4', 'Kh8', 'Bd5', 'Kh7', 'Be3', 'Kh8', 'Kf7', 'Kh7', 'Be4+', 'Kh8', 'Bd4#'],
      playerColor: 'white',
    });
    assert.ok((scoreOf(efficient, 6) ?? 0) > (scoreOf(detour, 8) ?? 5));
  });
});
