import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assessMateDrive } from '../mateDrive.ts';
import { gradeQuality } from '../comprehensionScore.ts';

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

  it('keeps a two-bishops mate on the edge as demonstrated', () => {
    const drive = assessMateDrive({
      initialFen: '6k1/8/5K2/8/8/8/5BB1/8 w - - 0 1',
      sans: ['Be4', 'Kh8', 'Bd5', 'Kh7', 'Be3', 'Kh8', 'Kf7', 'Kh7', 'Be4+', 'Kh8', 'Bd4#'],
      playerColor: 'white',
    });
    assert.equal(drive.demonstrated, true);
    assert.ok(drive.complete);
  });
});
