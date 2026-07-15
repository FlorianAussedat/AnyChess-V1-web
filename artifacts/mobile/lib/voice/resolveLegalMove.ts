/**
 * Resolve a MoveIntent against the current position's legal moves.
 *
 * Prefers speech intent + legal chess context over literal string matching.
 * Returns a unique match, an ambiguous candidate set, or null (no match).
 */
import { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import type { MoveIntent } from './types.ts';
import { describeIntent } from './extractMoveIntent.ts';

export type ResolveResult =
  | { status: 'unique'; move: Move; confidence: number }
  | { status: 'ambiguous'; candidates: Move[] }
  | { status: 'none' }
  | { status: 'illegal'; description: string };

function legalMoves(game: Chess): Move[] {
  return game.moves({ verbose: true }) as Move[];
}

function matchesIntent(m: Move, intent: MoveIntent, defaultPromotion: string): boolean {
  if (intent.castle === 'kingside') return m.flags.includes('k');
  if (intent.castle === 'queenside') return m.flags.includes('q');

  if (intent.piece && m.piece !== intent.piece) return false;
  if (intent.to && m.to !== intent.to) return false;
  if (intent.fromSquare && m.from !== intent.fromSquare) return false;
  if (intent.fromFile && m.from[0] !== intent.fromFile) return false;
  if (intent.fromRank && m.from[1] !== intent.fromRank) return false;

  if (intent.capture === true && !m.captured && !m.flags.includes('e')) {
    // Require capture when the speaker said "takes" / "prend"
    return false;
  }
  // If capture not asserted, still allow captures (speaker may omit "takes")

  const wantPromo = intent.promotion ?? (m.promotion ? defaultPromotion : undefined);
  if (m.promotion) {
    const expected = wantPromo ?? defaultPromotion;
    if (m.promotion !== expected) {
      // Allow if intent omitted promotion and we default to queen
      if (intent.promotion) return false;
      if (expected !== m.promotion) return false;
    }
  } else if (intent.promotion) {
    return false;
  }

  return true;
}

/**
 * Filter legal moves that satisfy the extracted intent.
 */
export function filterMovesByIntent(
  game: Chess,
  intent: MoveIntent,
  defaultPromotion: 'q' | 'r' | 'b' | 'n' = 'q',
): Move[] {
  const legal = legalMoves(game);

  if (intent.castle) {
    return legal.filter((m) =>
      intent.castle === 'kingside' ? m.flags.includes('k') : m.flags.includes('q'),
    );
  }

  // Bare "roque" kingside preference: if only queenside is legal, still match it
  // (handled by intent being kingside — if none, caller may retry)

  let candidates = legal.filter((m) => matchesIntent(m, intent, defaultPromotion));

  // Promotion defaulting: if pawn-to-last-rank and multiple promo choices,
  // prefer defaultPromotion when intent.promotion is unset.
  if (!intent.promotion && candidates.length > 1) {
    const withDefault = candidates.filter(
      (m) => !m.promotion || m.promotion === defaultPromotion,
    );
    if (withDefault.length >= 1) {
      candidates = withDefault;
    }
  }

  return candidates;
}

/**
 * Resolve intent to a legal move (or ambiguity / illegality).
 */
export function resolveAgainstLegalMoves(
  game: Chess,
  intent: MoveIntent,
  defaultPromotion: 'q' | 'r' | 'b' | 'n' = 'q',
): ResolveResult {
  let candidates = filterMovesByIntent(game, intent, defaultPromotion);

  // Bare kingside castle with no match → try any castling if speaker said "roque" intent kingside only
  if (intent.castle === 'kingside' && candidates.length === 0) {
    const anyCastle = legalMoves(game).filter(
      (m) => m.flags.includes('k') || m.flags.includes('q'),
    );
    if (anyCastle.length === 1) {
      return { status: 'unique', move: anyCastle[0], confidence: 0.85 };
    }
  }

  if (candidates.length === 1) {
    return { status: 'unique', move: candidates[0], confidence: 1 };
  }

  if (candidates.length > 1) {
    // Deduplicate by from/to/promotion
    const key = (m: Move) => `${m.from}${m.to}${m.promotion ?? ''}`;
    const uniq = [...new Map(candidates.map((m) => [key(m), m])).values()];
    if (uniq.length === 1) {
      return { status: 'unique', move: uniq[0], confidence: 1 };
    }
    return { status: 'ambiguous', candidates: uniq };
  }

  // Strong intent but no legal match → illegal (understood chess, wrong for position)
  if (
    intent.castle ||
    intent.to ||
    (intent.piece && intent.piece !== 'p') ||
    intent.capture
  ) {
    return { status: 'illegal', description: describeIntent(intent) };
  }

  return { status: 'none' };
}

/** Direct SAN attempt via chess.js (English / standard algebraic). */
export function tryDirectSan(input: string, game: Chess): Move | null {
  const clean = input.trim().replace(/\s+/g, '');
  if (!clean) return null;
  const attempts = clean === clean.toLowerCase() ? [clean] : [clean, clean.toLowerCase()];
  for (const attempt of attempts) {
    try {
      const clone = new Chess(game.fen());
      const played = clone.move(attempt);
      if (!played) continue;
      const legal = legalMoves(game);
      const found = legal.find((m) => m.from === played.from && m.to === played.to);
      if (found) {
        // Align promotion with played
        if (played.promotion) {
          const withPromo = legal.find(
            (m) =>
              m.from === played.from &&
              m.to === played.to &&
              m.promotion === played.promotion,
          );
          return withPromo ?? found;
        }
        return found;
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

/**
 * French SAN letter map → English for chess.js.
 *   C→N, F→B, T→R, D→Q, R→K (Roi carefully)
 */
export function frenchSanToEnglish(raw: string): string {
  return raw
    .replace(/×/g, 'x')
    .replace(/\s*x\s*/g, 'x')
    .replace(/^C(?=[a-h1-8x])/i, 'N')
    .replace(/^F(?=[a-h1-8x])/i, 'B')
    .replace(/^T(?=[a-h1-8x])/i, 'R')
    .replace(/^D(?=[a-h1-8x])/i, 'Q')
    .replace(/^R(?=[a-h][1-8][+#]?$)/i, 'K');
}
