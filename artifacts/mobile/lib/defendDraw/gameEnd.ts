/**
 * Regulatory end-of-game detection for Défends la nulle.
 * Single source of truth: the live chess.js game instance.
 */
import type { Chess } from 'chess.js';

export type RegulatoryEndKind =
  | 'checkmate'
  | 'stalemate'
  | 'insufficient'
  | 'threefold'
  | 'fifty';

export type RegulatoryEnd =
  | { kind: 'checkmate'; winner: 'w' | 'b' }
  | { kind: 'stalemate' }
  | { kind: 'insufficient' }
  | { kind: 'threefold' }
  | { kind: 'fifty' };

export type RegulatorySuccessKind = Exclude<RegulatoryEndKind, 'checkmate'>;

/**
 * After any legal move on `game`, return the terminal state if the rules
 * say the game is over. Prefer chess.js methods — do not reimplement FIDE.
 */
export function evaluateRegulatoryEnd(game: Chess): RegulatoryEnd | null {
  if (game.isCheckmate()) {
    // Side to move is mated → the other side won.
    const mated = game.turn();
    return { kind: 'checkmate', winner: mated === 'w' ? 'b' : 'w' };
  }
  if (game.isStalemate()) return { kind: 'stalemate' };
  if (game.isInsufficientMaterial()) return { kind: 'insufficient' };
  if (game.isThreefoldRepetition()) return { kind: 'threefold' };
  if (game.isDrawByFiftyMoves()) return { kind: 'fifty' };
  return null;
}

export function regulatorySuccessMessage(kind: RegulatorySuccessKind): string {
  switch (kind) {
    case 'stalemate':
      return 'Pat. Finale réussie !';
    case 'insufficient':
      return 'Nulle obtenue par matériel insuffisant. Finale réussie !';
    case 'threefold':
      return 'Nulle par répétition. Finale réussie !';
    case 'fifty':
      return 'Nulle par règle des 50 coups. Finale réussie !';
  }
}

export function isRegulatoryDraw(end: RegulatoryEnd): end is Exclude<
  RegulatoryEnd,
  { kind: 'checkmate' }
> {
  return end.kind !== 'checkmate';
}
