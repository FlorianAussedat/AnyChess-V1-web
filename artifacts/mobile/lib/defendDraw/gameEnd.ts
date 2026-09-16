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

/**
 * Determine if the game result means success for the player given their objective.
 * WIN: only a player win is success. DRAW: draw or win = success, loss = failure.
 */
export function isObjectiveSuccess(
  end: RegulatoryEnd,
  playerColor: 'w' | 'b',
  objective: 'WIN' | 'DRAW',
): boolean {
  if (end.kind === 'checkmate') {
    const playerWon = end.winner === playerColor;
    return objective === 'WIN' ? playerWon : playerWon;
  }
  // All regulatory draws
  return objective === 'DRAW';
}

/**
 * Feedback message adapted to the objective.
 */
export function objectiveFeedbackMessage(
  end: RegulatoryEnd,
  playerColor: 'w' | 'b',
  objective: 'WIN' | 'DRAW',
): string {
  if (end.kind === 'checkmate') {
    const playerWon = end.winner === playerColor;
    if (playerWon) {
      return objective === 'WIN'
        ? 'Mat ! Finale gagnée !'
        : 'Mat ! Position gagnée.';
    }
    return 'Mat forcé détecté.';
  }

  const drawLabel = regulatorySuccessMessage(end.kind);
  if (objective === 'DRAW') {
    return drawLabel;
  }
  // WIN objective + draw = failure
  const reason = drawLabel.replace(/Finale réussie !$/, '').trim();
  return `${reason} Nulle — objectif non atteint.`;
}
