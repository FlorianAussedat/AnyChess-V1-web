/**
 * Opponent move choice for Défends la nulle.
 * Tablebase filters objective outcomes; Stockfish (when provided) picks
 * the most human-pressuring move among those that keep max pressure.
 */
import { Chess, type Move } from 'chess.js';
import {
  probeTablebaseMoves,
  probeWdlForPlayer,
  type WdlProbeOptions,
} from './WdlProbe.ts';
import type { WdlVerdict } from './wdl.ts';

export type OpponentPick = {
  from: string;
  to: string;
  promotion?: string;
};

export type StockfishPickFn = (game: Chess) => Promise<OpponentPick | null>;

export type PickOpponentMoveOptions = {
  probeOptions?: WdlProbeOptions;
  /** Strong engine suggestion (does not override tablebase truth). */
  stockfishPick?: StockfishPickFn;
  rng?: () => number;
};

function pressureScoreForDefender(verdict: WdlVerdict): number {
  // Higher = worse for the defender (better for the attacking opponent).
  if (verdict === 'loss') return 3;
  if (verdict === 'unknown') return 1;
  if (verdict === 'draw') return 0;
  return -2; // win for defender — opponent should avoid
}

/**
 * Choose an opponent move that maximizes pressure on the defender.
 */
export async function pickOpponentMove(
  fen: string,
  playerColor: 'w' | 'b',
  options: PickOpponentMoveOptions = {},
): Promise<OpponentPick | null> {
  const game = new Chess(fen);
  const legal = game.moves({ verbose: true }) as Move[];
  if (legal.length === 0) return null;

  const probeOptions = options.probeOptions ?? {};
  const rng = options.rng ?? Math.random;

  // Prefer tablebase classification of each reply when available.
  const tbMoves = await probeTablebaseMoves(fen, probeOptions);
  type Scored = { pick: OpponentPick; score: number };
  const scored: Scored[] = [];

  if (tbMoves.length > 0) {
    for (const m of tbMoves) {
      // TB verdict is from STM (opponent) perspective after... wait:
      // Lichess moves[].category is the category of the position AFTER the move,
      // from the side that would then move? Actually Lichess docs:
      // "category of the position after the move" from the POV of the player to move before? 
      // In practice: move.category "win" means the side that just moved can force a win
      // i.e. the position is winning for the side that played. For STM choosing a move,
      // "win" = this move leads to a win for STM.
      // Defender is the other side, so opponent win => defender loss. Score high.
      const afterForDefender: WdlVerdict =
        m.verdict === 'win'
          ? 'loss'
          : m.verdict === 'loss'
            ? 'win'
            : m.verdict === 'draw'
              ? 'draw'
              : 'unknown';
      scored.push({
        pick: { from: m.from, to: m.to, promotion: m.promotion },
        score: pressureScoreForDefender(afterForDefender),
      });
    }
  } else {
    for (const m of legal) {
      const g = new Chess(fen);
      g.move({ from: m.from, to: m.to, promotion: m.promotion });
      const probe = await probeWdlForPlayer(g.fen(), playerColor, probeOptions);
      scored.push({
        pick: {
          from: m.from,
          to: m.to,
          promotion: m.promotion,
        },
        score: pressureScoreForDefender(probe.verdict),
      });
    }
  }

  if (scored.length === 0) return null;
  const bestScore = Math.max(...scored.map((s) => s.score));
  const top = scored.filter((s) => s.score === bestScore);

  // Among maximal-pressure moves, prefer Stockfish's suggestion if it matches.
  if (options.stockfishPick) {
    try {
      const sf = await options.stockfishPick(new Chess(fen));
      if (sf) {
        const match = top.find(
          (s) =>
            s.pick.from === sf.from &&
            s.pick.to === sf.to &&
            (s.pick.promotion ?? 'q') === (sf.promotion ?? 'q'),
        );
        if (match) return match.pick;
        // If SF pick is in the full scored list at best tier-1, still allow if score close
        const sfScored = scored.find(
          (s) => s.pick.from === sf.from && s.pick.to === sf.to,
        );
        if (sfScored && sfScored.score >= bestScore - 0) return sfScored.pick;
      }
    } catch {
      /* ignore engine errors */
    }
  }

  return top[Math.floor(rng() * top.length)]!.pick;
}
