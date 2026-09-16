/**
 * Verbal description of a chess position (blind puzzle mode).
 * White pieces first, then Black; group identical pieces; side to move;
 * castling / en passant when relevant. Squares use algebraic form (e4).
 * Follows app language (independent of chessNotation).
 */
import { Chess } from 'chess.js';
import { preferencesStore } from '../preferences/PreferencesStore.ts';
import type { AppLanguage } from '../preferences/types.ts';
import { tMsg } from '../i18n/tMsg.ts';

const PIECE_FR: Record<string, string> = {
  k: 'Roi',
  q: 'Dame',
  r: 'Tour',
  b: 'Fou',
  n: 'Cavalier',
  p: 'Pion',
};

const PIECE_EN: Record<string, string> = {
  k: 'King',
  q: 'Queen',
  r: 'Rook',
  b: 'Bishop',
  n: 'Knight',
  p: 'Pawn',
};

const PIECE_ORDER = ['k', 'q', 'r', 'b', 'n', 'p'] as const;

function lang(): AppLanguage {
  try {
    return preferencesStore.getPreferences().language;
  } catch {
    return 'fr';
  }
}

function pluralPiece(type: string, count: number, language: AppLanguage): string {
  const table = language === 'en' ? PIECE_EN : PIECE_FR;
  const base = table[type] ?? type;
  if (count === 1) return base;
  if (language === 'en') {
    if (type === 'p') return 'Pawns';
    if (type === 'n') return 'Knights';
    if (type === 'b') return 'Bishops';
    if (type === 'r') return 'Rooks';
    if (type === 'q') return 'Queens';
    if (type === 'k') return 'Kings';
    return `${base}s`;
  }
  if (type === 'p') return 'Pions';
  if (type === 'n') return 'Cavaliers';
  if (type === 'b') return 'Fous';
  if (type === 'r') return 'Tours';
  if (type === 'q') return 'Dames';
  return base;
}

function describeSide(
  game: Chess,
  color: 'w' | 'b',
  language: AppLanguage,
): string {
  const label =
    language === 'en'
      ? color === 'w'
        ? 'White’s position'
        : 'Black’s position'
      : color === 'w'
        ? 'Position des Blancs'
        : 'Position des Noirs';
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
    const name = pluralPiece(type, squares.length, language);
    const prep = language === 'en' ? 'on' : 'en';
    const and = language === 'en' ? 'and' : 'et';
    if (squares.length === 1) {
      lines.push(`${name} ${prep} ${squares[0]}.`);
    } else if (squares.length === 2) {
      lines.push(`${name} ${prep} ${squares[0]} ${and} ${squares[1]}.`);
    } else {
      const head = squares.slice(0, -1).join(', ');
      const last = squares[squares.length - 1];
      lines.push(`${name} ${prep} ${head} ${and} ${last}.`);
    }
  }
  if (!any) {
    lines.push(language === 'en' ? 'No pieces.' : 'Aucune pièce.');
  }
  return lines.join('\n');
}

function castlingLine(game: Chess, language: AppLanguage): string | null {
  const rights: string[] = [];
  const fenParts = game.fen().split(' ');
  const castling = fenParts[2] ?? '-';
  if (castling === '-') return null;
  if (language === 'en') {
    if (castling.includes('K')) rights.push('White kingside');
    if (castling.includes('Q')) rights.push('White queenside');
    if (castling.includes('k')) rights.push('Black kingside');
    if (castling.includes('q')) rights.push('Black queenside');
    if (rights.length === 0) return null;
    return `Castling rights: ${rights.join(', ')}.`;
  }
  if (castling.includes('K')) rights.push('petit roque blanc');
  if (castling.includes('Q')) rights.push('grand roque blanc');
  if (castling.includes('k')) rights.push('petit roque noir');
  if (castling.includes('q')) rights.push('grand roque noir');
  if (rights.length === 0) return null;
  return `Roques possibles : ${rights.join(', ')}.`;
}

function enPassantLine(game: Chess, language: AppLanguage): string | null {
  const fenParts = game.fen().split(' ');
  const ep = fenParts[3];
  if (!ep || ep === '-') return null;
  return language === 'en'
    ? `En passant capture possible toward ${ep}.`
    : `Prise en passant possible vers ${ep}.`;
}

/**
 * Build a full narration of `fen` (or the current position of `game`).
 * Side-to-move is omitted by default — show it once in the UI instead.
 */
export type NarratePositionOptions = {
  /** Append Trait aux Blancs/Noirs (default false to avoid UI duplication). */
  includeSideToMove?: boolean;
};

export function narratePosition(
  fenOrGame: string | Chess,
  options?: NarratePositionOptions,
): string {
  const game = typeof fenOrGame === 'string' ? new Chess(fenOrGame) : fenOrGame;
  const language = lang();
  const parts: string[] = [
    describeSide(game, 'w', language),
    '',
    describeSide(game, 'b', language),
  ];

  // Side-to-move is shown once in the UI (not duplicated inside narration).
  if (options?.includeSideToMove) {
    parts.push('');
    parts.push(
      game.turn() === 'w' ? tMsg('puzzle.sideWhite') : tMsg('puzzle.sideBlack'),
    );
  }

  const castling = castlingLine(game, language);
  if (castling) parts.push(castling);

  const ep = enPassantLine(game, language);
  if (ep) parts.push(ep);

  return parts.join('\n');
}

/** Spoken / TTS-friendly one-line summary (same content, flatter). */
export function narratePositionSpoken(
  fenOrGame: string | Chess,
  options?: NarratePositionOptions,
): string {
  return narratePosition(fenOrGame, options).replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Exported for tests / callers that need piece naming. */
export function frenchPieceName(type: string): string {
  return PIECE_FR[type] ?? type;
}
