import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AttemptResult } from '../types.ts';
import {
  buildDiagnosticView,
  formatDecisiveMoveLabel,
  formatReviewEval,
  reviewHeadlineKey,
  showReviewGauge,
} from '../reviewDiagnostic.ts';

const FEN_WHITE_52 = '8/8/8/8/8/8/4K3/7R w - - 0 52';
const FEN_BLACK_52 = '8/8/8/2K5/1pP5/1kq5/8/1Q6 b - - 3 52';

function loss(partial: Partial<AttemptResult> = {}): AttemptResult {
  return {
    outcome: 'loss',
    movesResisted: 4,
    timeline: [],
    moveSans: ['Qb2'],
    startFen: FEN_BLACK_52,
    endFen: FEN_BLACK_52,
    positionId: 'P',
    finishedAt: '2026-08-20T00:00:00.000Z',
    fenBeforeLoss: FEN_BLACK_52,
    losingSan: 'Qb2',
    evalBeforeLossCp: -20,
    evalAfterLossCp: -240,
    drawAlternatives: [{ san: 'Ka4', scoreCp: -10 }],
    drawAlternativesReliable: true,
    ...partial,
  };
}

describe('defend-draw review diagnostic', () => {
  it('formats the real move number for White and Black', () => {
    assert.equal(formatDecisiveMoveLabel(FEN_WHITE_52, 'Rh2', 'white', 'en'), '52. Rh2');
    assert.equal(formatDecisiveMoveLabel(FEN_BLACK_52, 'Qb2', 'black', 'en'), '52... Qb2');
    assert.equal(formatDecisiveMoveLabel(FEN_BLACK_52, 'Qb2', 'black', 'fr'), '52... Db2');
    assert.doesNotMatch(
      formatDecisiveMoveLabel(FEN_BLACK_52, 'Qb2', 'black', 'en') ?? '',
      /^0\./,
    );
  });

  it('does not attribute an opponent move to the user', () => {
    assert.equal(formatDecisiveMoveLabel(FEN_WHITE_52, 'Rh2', 'black', 'en'), null);
    const view = buildDiagnosticView(
      loss({ fenBeforeLoss: FEN_WHITE_52, losingSan: 'Rh2' }),
      'black',
      'en',
    );
    assert.equal(view.status, 'uncertain');
  });

  it('shows mate as mate and keeps a missing eval distinct from equality', () => {
    assert.equal(formatReviewEval(0, null).kind, 'score');
    assert.equal(formatReviewEval(0, null).kind === 'score' && formatReviewEval(0, null).text, '0.00');
    assert.equal(formatReviewEval(undefined, null).kind, 'missing');
    assert.equal(formatReviewEval(null, undefined).kind, 'missing');
    const mate = formatReviewEval(-99998, -2);
    assert.equal(mate.kind, 'mate');
    if (mate.kind === 'mate') assert.equal(mate.text, '#-2');
    const encoded = formatReviewEval(-(100_000 - 3), null);
    assert.equal(encoded.kind, 'mate');
    if (encoded.kind === 'mate') assert.match(encoded.text, /#/);
    assert.doesNotMatch(encoded.kind === 'mate' ? encoded.text : '', /999/);
  });

  it('uses the FEN from before the error for alternatives and marks a partial list', () => {
    const fen = FEN_BLACK_52;
    const view = buildDiagnosticView(
      loss({
        fenBeforeLoss: fen,
        drawAlternatives: [
          { san: 'Ka4', scoreCp: -10 },
          { san: 'Qb4', scoreCp: -30 },
        ],
        drawAlternativesHasMore: true,
        drawAlternativesReliable: true,
      }),
      'black',
      'en',
    );
    assert.equal(view.status, 'ready');
    if (view.status !== 'ready') return;
    assert.equal(view.fenBeforeLoss, fen);
    assert.deepEqual(view.alternatives, ['Ka4', 'Qb4']);
    assert.equal(view.partial, true);
    assert.equal(view.moveLabel, '52... Qb2');
  });

  it('hides a diagnostic that is not a loss and stays uncertain without a move', () => {
    assert.equal(buildDiagnosticView(loss({ outcome: 'win-30-moves' }), 'black', 'en').status, 'hidden');
    assert.equal(buildDiagnosticView(loss({ losingSan: undefined }), 'black', 'en').status, 'uncertain');
    assert.equal(reviewHeadlineKey({ outcome: 'abandoned' }), 'quiz.ddResultInterrupted');
    assert.equal(reviewHeadlineKey({ outcome: 'loss' }), 'quiz.ddResultLoss');
    assert.equal(
      reviewHeadlineKey({
        outcome: 'win-official-draw',
        officialDrawReason: 'stalemate',
        playerColor: 'white',
      }),
      'quiz.ddResultStalemate',
    );
    assert.equal(
      reviewHeadlineKey({
        outcome: 'win-official-draw',
        checkmateWinner: 'w',
        playerColor: 'white',
      }),
      'quiz.ddResultWin',
    );
    assert.equal(showReviewGauge('loss'), true);
    assert.equal(showReviewGauge('abandoned'), false);
    assert.equal(showReviewGauge('in-progress'), false);
  });
});
