/**
 * Canonical move representation shared by touch, text and voice inputs.
 */
import type { Move } from 'chess.js';

export type MoveInputSource = 'voice' | 'text' | 'touch' | 'mouse';

export interface CanonicalMove {
  from: string;
  to: string;
  promotion?: string;
  san?: string;
  source: MoveInputSource;
}

export function canonicalFromChessMove(
  move: Move,
  source: MoveInputSource,
): CanonicalMove {
  return {
    from: move.from,
    to: move.to,
    promotion: move.promotion,
    san: move.san,
    source,
  };
}

export function sameCanonicalMove(a: CanonicalMove, b: CanonicalMove): boolean {
  return (
    a.from === b.from &&
    a.to === b.to &&
    (a.promotion ?? 'q') === (b.promotion ?? 'q')
  );
}

/** Success / error feedback for voice & text only (not touch/mouse). */
export function shouldEmitMoveRecognizedFeedback(source: MoveInputSource): boolean {
  return source === 'voice' || source === 'text';
}
