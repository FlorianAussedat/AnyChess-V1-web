import { Chess } from 'chess.js';
import type { LocalPuzzle } from '../puzzles/types.ts';
import { puzzleRepository } from '../puzzles/PuzzleRepository.ts';
import type { MoveNamingChallenge } from './types.ts';

function applyUci(game: Chess, uci: string) {
  return game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
}

export function buildMoveNamingChallenge(puzzle: LocalPuzzle): MoveNamingChallenge | null {
  const setup = puzzle.moves[0];
  if (!setup) return null;
  const game = new Chess(puzzle.fen);
  const setupMove = applyUci(game, setup);
  if (!setupMove) return null;
  return {
    puzzleId: puzzle.id,
    initialFen: puzzle.fen,
    positionFen: game.fen(),
    setupSan: setupMove.san,
    setupMove: { from: setupMove.from, to: setupMove.to, promotion: setupMove.promotion },
    expectedSan: setupMove.san,
  };
}

export function pickMoveNamingChallenge(
  previousId?: string,
  rng: () => number = Math.random,
): MoveNamingChallenge | null {
  const available = puzzleRepository.getAll().filter((p) => p.moves.length > 0 && p.id !== previousId);
  const puzzle = available[Math.floor(rng() * available.length)];
  return puzzle ? buildMoveNamingChallenge(puzzle) : null;
}
