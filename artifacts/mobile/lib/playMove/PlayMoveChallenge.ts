import { Chess } from 'chess.js';
import { sanToVerbal } from '../chessParser.ts';
import {
  buildMoveNamingChallenge,
  pickMoveNamingChallenge,
} from '../moveNaming/MoveNamingChallenge.ts';
import type { LocalPuzzle } from '../puzzles/types.ts';
import { puzzleRepository } from '../puzzles/PuzzleRepository.ts';
import type { PlayMoveChallenge } from './types.ts';

/**
 * Prefer reliable challenges for board interaction:
 * - skip promotions (UI defaults to queen; notation can be ambiguous)
 * - keep castling / captures / normal moves (ChessBoard validates them)
 */
export function isReliablePlayMoveChallenge(challenge: PlayMoveChallenge): boolean {
  if (challenge.setupMove.promotion) return false;
  if (/=/.test(challenge.setupSan)) return false;
  // Sanity: move must still be legal from initialFen
  const game = new Chess(challenge.initialFen);
  const legal = game
    .moves({ verbose: true })
    .some(
      (m) =>
        m.from === challenge.setupMove.from &&
        m.to === challenge.setupMove.to &&
        !m.promotion,
    );
  return legal;
}

export function buildPlayMoveChallenge(puzzle: LocalPuzzle): PlayMoveChallenge | null {
  const base = buildMoveNamingChallenge(puzzle);
  if (!base) return null;
  const challenge: PlayMoveChallenge = {
    ...base,
    promptVerbal: sanToVerbal(base.setupSan),
  };
  return isReliablePlayMoveChallenge(challenge) ? challenge : null;
}

export function pickPlayMoveChallenge(
  previousId?: string,
  rng: () => number = Math.random,
  maxAttempts = 40,
): PlayMoveChallenge | null {
  const available = puzzleRepository
    .getAll()
    .filter((p) => p.moves.length > 0 && p.id !== previousId);
  if (available.length === 0) {
    // Fall back to move-naming picker then filter
    for (let i = 0; i < maxAttempts; i += 1) {
      const base = pickMoveNamingChallenge(previousId, undefined, rng);
      if (!base) return null;
      const challenge: PlayMoveChallenge = {
        ...base,
        promptVerbal: sanToVerbal(base.setupSan),
      };
      if (isReliablePlayMoveChallenge(challenge)) return challenge;
    }
    return null;
  }

  for (let i = 0; i < maxAttempts; i += 1) {
    const puzzle = available[Math.floor(rng() * available.length)];
    if (!puzzle) continue;
    const challenge = buildPlayMoveChallenge(puzzle);
    if (challenge && challenge.puzzleId !== previousId) return challenge;
  }

  // Last resort: return any buildable challenge even if promotion (default q)
  const fallback = pickMoveNamingChallenge(previousId, undefined, rng);
  if (!fallback) return null;
  return {
    ...fallback,
    promptVerbal: sanToVerbal(fallback.setupSan),
  };
}

/** Validate a played from/to against the active challenge. */
export function isCorrectPlayMove(
  challenge: PlayMoveChallenge,
  from: string,
  to: string,
  promotion?: string | null,
): boolean {
  if (challenge.setupMove.from !== from || challenge.setupMove.to !== to) return false;
  const expectedPromo = challenge.setupMove.promotion;
  if (expectedPromo) {
    return (promotion ?? 'q') === expectedPromo;
  }
  return true;
}
