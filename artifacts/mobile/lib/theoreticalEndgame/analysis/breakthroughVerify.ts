/**
 * Independent check of the pawn-breakthrough catalog.
 * One automated draw does not decide whether the FEN is wrong, the player
 * protocol missed the break, or the engine/end test is at fault.
 */
import { Chess } from 'chess.js';
import type { DefenseAnalyzer } from '../../defendDraw/defenseTypes.ts';
import { getPositionById, listByTheme } from '../selection/selectors.ts';

export type BreakthroughLineCheck = {
  positionId: string;
  fen: string;
  line: string[];
  outcome: 'checkmate' | 'promotion' | 'draw' | 'interrupted' | 'illegal';
  userPromoted: boolean;
  winner: 'white' | 'black' | null;
};

export type BreakthroughSearch = {
  positionId: string;
  movetimeMs: number;
  bestSan: string | null;
  mateIn: number | null;
  scoreCp: number | null;
};

/** Classical breaks: b6 vs a7-b7-c7; bxa5 when pawns already touch. */
export const BREAKTHROUGH_REFERENCE_LINES: ReadonlyArray<{
  positionId: string;
  sans: string[];
}> = [
  {
    positionId: 'TE-CANON-PAWN-BREAKTHROUGH',
    sans: [
      'b6', 'cxb6', 'a6', 'bxa6', 'c6', 'Kg7', 'c7', 'Kf7', 'c8=Q', 'a5', 'Qb7+', 'Ke6',
      'Qxa7', 'a4', 'Qxa4', 'Kd6', 'Qc4', 'Kd7', 'Ke2', 'Kd6', 'Ke3', 'Ke5', 'Qb5+', 'Kf6',
      'Kd4', 'Ke6', 'Ke4', 'Kf7', 'Qxb6', 'Kf8', 'Qb7', 'Ke8', 'Ke5', 'Kf8', 'Kf6', 'Kg8', 'Qg7#',
    ],
  },
  {
    positionId: 'TE-CANON-PAWN-BREAKTHROUGH',
    sans: ['b6', 'axb6', 'c6', 'bxc6', 'a6', 'Kg7', 'a7', 'Kf7', 'a8=Q'],
  },
  {
    positionId: 'TE-CANON-PAWN-BREAKTHROUGH-2',
    sans: [
      'bxa5', 'bxa4', 'a6', 'Kd7', 'a7', 'Kc7', 'a8=Q', 'Kd6', 'Qxa4', 'Ke7', 'Qa7+', 'Ke8',
      'Qxc5', 'Kd7', 'Kd2', 'Kd8', 'Qc6', 'Ke7', 'Qd5', 'Kf6', 'c5', 'Kg6', 'c6', 'Kh7',
      'c7', 'Kg6', 'c8=Q', 'Kh7', 'Qcg8+', 'Kh6', 'Qh1#',
    ],
  },
  {
    positionId: 'TE-CANON-PAWN-BREAKTHROUGH-3',
    sans: [
      'exd5', 'exd4', 'd6', 'Kg2', 'd7', 'Kf3', 'd8=Q', 'Ke4', 'Ke2', 'Kxf4', 'Qxd4+', 'Kg5',
      'Ke3', 'f4+', 'Qxf4+', 'Kg6', 'Kf3', 'Kg7', 'Qf5', 'Kh8', 'Qf6+', 'Kg8', 'Kf4', 'Kh7',
      'Kf5', 'Kg8', 'Qe7', 'Kh8', 'Kf6', 'Kg8', 'Qg7#',
    ],
  },
];

export function replayBreakthroughLine(positionId: string, sans: string[]): BreakthroughLineCheck {
  const position = getPositionById(positionId);
  const fen = position?.initialFen ?? '';
  const base: BreakthroughLineCheck = {
    positionId,
    fen,
    line: sans,
    outcome: 'illegal',
    userPromoted: false,
    winner: null,
  };
  if (!position) return base;
  const game = new Chess(position.initialFen);
  const user = position.playerColor === 'white' ? 'w' : 'b';
  let userPromoted = false;
  for (const san of sans) {
    const side = game.turn();
    let move: { san: string; promotion?: string } | null = null;
    try {
      move = game.move(san);
    } catch {
      return { ...base, outcome: 'illegal', userPromoted };
    }
    if (!move) return { ...base, outcome: 'illegal', userPromoted };
    if (side === user && (move.promotion === 'q' || move.promotion === 'r')) userPromoted = true;
  }
  if (game.isCheckmate()) {
    const winner = game.turn() === 'w' ? 'black' : 'white';
    return { ...base, outcome: 'checkmate', userPromoted, winner };
  }
  if (userPromoted) return { ...base, outcome: 'promotion', userPromoted, winner: null };
  if (game.isDraw()) return { ...base, outcome: 'draw', userPromoted, winner: null };
  return { ...base, outcome: 'interrupted', userPromoted, winner: null };
}

export function legalFirstMoves(fen: string): string[] {
  return new Chess(fen).moves();
}

export async function searchBreakthroughs(
  analyzer: DefenseAnalyzer,
  movetimeMs: number,
): Promise<BreakthroughSearch[]> {
  const rows: BreakthroughSearch[] = [];
  for (const position of listByTheme('pawn-breakthrough')) {
    const game = new Chess(position.initialFen);
    const analysis = await analyzer.analyze(position.initialFen, movetimeMs);
    let bestSan: string | null = null;
    if (analysis.bestMove) {
      try {
        const played = game.move({
          from: analysis.bestMove.from,
          to: analysis.bestMove.to,
          promotion: (analysis.bestMove.promotion as 'q' | undefined) ?? undefined,
        });
        bestSan = played?.san ?? null;
      } catch {
        bestSan = null;
      }
    }
    rows.push({
      positionId: position.id,
      movetimeMs,
      bestSan,
      mateIn: analysis.mateIn,
      scoreCp: analysis.scoreCp,
    });
  }
  return rows;
}

export { breakMoveAmong } from '../domain/pawnWinProgress.ts';
