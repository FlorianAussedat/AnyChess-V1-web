/**
 * French verbal description of a chess position (blind puzzle mode).
 * White pieces first, then Black; group identical pieces; side to move;
 * castling / en passant when relevant. Squares use algebraic form (e4).
 */
import { Chess } from 'chess.js';

const PIECE_FR: Record<string, string> = {
  k: 'Roi',
  q: 'Dame',
  r: 'Tour',
  b: 'Fou',
  n: 'Cavalier',
  p: 'Pion',
};

const PIECE_ORDER = ['k', 'q', 'r', 'b', 'n', 'p'] as const;

function pluralPiece(type: string, count: number): string {
  const base = PIECE_FR[type] ?? type;
  if (count === 1) return base;
  if (type === 'p') return 'Pions';
  if (type === 'n') return 'Cavaliers';
  if (type === 'b') return 'Fous';
  if (type === 'r') return 'Tours';
  if (type === 'q') return 'Dames';
  return base;
}

function describeSide(game: Chess, color: 'w' | 'b'): string {
  const label = color === 'w' ? 'Position des Blancs' : 'Position des Noirs';
  const groups = new Map<string, string[]>();

  for (const row of game.board()) {
    for (const cell of row) {
      if (!cell || cell.color !== color) continue;
      const list = groups.get(cell.type) ?? [];
      list.push(cell.square);
      groups.set(cell.type, list);
    }
  }

  const lines: string[] = [`${label} :`];
  let any = false;
  for (const type of PIECE_ORDER) {
    const squares = groups.get(type);
    if (!squares || squares.length === 0) continue;
    any = true;
    squares.sort();
    const name = pluralPiece(type, squares.length);
    if (squares.length === 1) {
      lines.push(`${name} en ${squares[0]}.`);
    } else if (squares.length === 2) {
      lines.push(`${name} en ${squares[0]} et ${squares[1]}.`);
    } else {
      const head = squares.slice(0, -1).join(', ');
      const last = squares[squares.length - 1];
      lines.push(`${name} en ${head} et ${last}.`);
    }
  }
  if (!any) {
    lines.push('Aucune pièce.');
  }
  return lines.join('\n');
}

function castlingLine(game: Chess): string | null {
  const rights: string[] = [];
  // Probe castling by checking FEN rights field.
  const fenParts = game.fen().split(' ');
  const castling = fenParts[2] ?? '-';
  if (castling === '-') return null;
  if (castling.includes('K')) rights.push('petit roque blanc');
  if (castling.includes('Q')) rights.push('grand roque blanc');
  if (castling.includes('k')) rights.push('petit roque noir');
  if (castling.includes('q')) rights.push('grand roque noir');
  if (rights.length === 0) return null;
  return `Roques possibles : ${rights.join(', ')}.`;
}

function enPassantLine(game: Chess): string | null {
  const fenParts = game.fen().split(' ');
  const ep = fenParts[3];
  if (!ep || ep === '-') return null;
  return `Prise en passant possible vers ${ep}.`;
}

/**
 * Build a full French narration of `fen` (or the current position of `game`).
 */
export function narratePosition(fenOrGame: string | Chess): string {
  const game = typeof fenOrGame === 'string' ? new Chess(fenOrGame) : fenOrGame;
  const parts: string[] = [
    describeSide(game, 'w'),
    '',
    describeSide(game, 'b'),
    '',
    game.turn() === 'w' ? 'Trait aux Blancs.' : 'Trait aux Noirs.',
  ];

  const castling = castlingLine(game);
  if (castling) parts.push(castling);

  const ep = enPassantLine(game);
  if (ep) parts.push(ep);

  return parts.join('\n');
}

/** Spoken / TTS-friendly one-line summary (same content, flatter). */
export function narratePositionSpoken(fenOrGame: string | Chess): string {
  return narratePosition(fenOrGame).replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Exported for tests / callers that need piece naming. */
export function frenchPieceName(type: string): string {
  return PIECE_FR[type] ?? type;
}
