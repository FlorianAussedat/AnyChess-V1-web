import { tMsg } from '../i18n/tMsg.ts';
import { presentAppDialog } from '../ui/appDialogStore.ts';
import type { OpeningReviewAttemptSnapshot } from '../repertoire/openingReviewAttempt.ts';

function pluralWord(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

export function reviewBilanMessage(input: {
  lineName: string;
  stats: OpeningReviewAttemptSnapshot;
  totalAttempts: number;
  totalSuccesses: number;
}): string {
  const { lineName, stats, totalAttempts, totalSuccesses } = input;
  const errorWord = pluralWord(
    stats.errorMoveCount,
    tMsg('openings.reviewMoveSingular'),
    tMsg('openings.reviewMovePlural'),
  );
  const moveWord = pluralWord(
    stats.userMovesToFind,
    tMsg('openings.reviewMoveSingular'),
    tMsg('openings.reviewMovePlural'),
  );
  const revealedWord = pluralWord(
    stats.revealedMoveCount,
    tMsg('openings.reviewMoveSingular'),
    tMsg('openings.reviewMovePlural'),
  );
  const revealedVerb = pluralWord(
    stats.revealedMoveCount,
    tMsg('openings.reviewRevealedSingular'),
    tMsg('openings.reviewRevealedPlural'),
  );
  const lines = [
    lineName.trim(),
    tMsg('openings.lineFinishedErrors', {
      errors: stats.errorMoveCount,
      errorWord,
      moves: stats.userMovesToFind,
      moveWord,
    }),
    tMsg('openings.lineFinishedRevealed', {
      count: stats.revealedMoveCount,
      moveWord: revealedWord,
      revealed: revealedVerb,
    }),
    tMsg('openings.lineFinishedLifetime', {
      completed: totalAttempts,
      successes: totalSuccesses,
    }),
  ].filter((line) => line.length > 0);
  return lines.join('\n\n');
}

export function presentReviewLineBilan(options: {
  lineName: string;
  stats: OpeningReviewAttemptSnapshot;
  totalAttempts: number;
  totalSuccesses: number;
  hasFinalComment: boolean;
  onShowFinalComment?: () => void;
}): void {
  presentAppDialog({
    title: tMsg('openings.lineFinishedTitle'),
    message: reviewBilanMessage(options),
    variant: 'info',
    actions: [
      {
        label: tMsg('openings.close'),
        onPress: () => {},
        variant: options.hasFinalComment ? 'secondary' : 'primary',
        testID: 'review-bilan-close',
      },
      ...(options.hasFinalComment
        ? [
            {
              label: tMsg('openings.seeFinalComment'),
              onPress: () => options.onShowFinalComment?.(),
              variant: 'primary' as const,
              testID: 'review-bilan-final-comment',
            },
          ]
        : []),
    ],
  });
}

export function presentPgnCommentDialog(title: string, comment: string): void {
  const body = comment.trim();
  if (!body) return;
  presentAppDialog({
    title,
    message: body,
    variant: 'info',
    actions: [
      {
        label: tMsg('openings.close'),
        onPress: () => {},
        variant: 'primary',
        testID: 'pgn-comment-close',
      },
    ],
  });
}
