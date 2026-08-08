import { sanToVerbal } from '../chessParser.ts';
import { speechService } from '../../services/SpeechService.ts';

/**
 * Queue a verbal move-by-move summary (shared Classic / Openings core).
 * Callers may speak mode-specific preamble before invoking this — pass
 * `skipCancel: true` so the preamble is not flushed.
 */
export function speakMoveHistorySummary(
  moves: string[],
  opts?: { emptyMessage?: string; skipCancel?: boolean },
): void {
  if (!moves.length) {
    speechService.speak(opts?.emptyMessage ?? 'Aucun coup joué pour le moment.', {
      flush: true,
    });
    return;
  }
  if (!opts?.skipCancel) {
    speechService.cancel('summarize');
  }
  moves.forEach((san, i) => {
    const pairNum = Math.floor(i / 2) + 1;
    const isWhite = i % 2 === 0;
    const verbal = sanToVerbal(san);
    speechService.speak(isWhite ? `${pairNum}. ${verbal}` : verbal);
  });
}
