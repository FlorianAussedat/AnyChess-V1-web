/**
 * Chess verbalization + legacy voice-parse facade.
 *
 * Move/command parsing lives in `lib/voice/` (provider-agnostic).
 * This module keeps TTS helpers and re-exports the parser for existing imports.
 */
import { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import {
  CHESS_CONTEXT_STRINGS,
  normalizeTranscript,
  parseChessVoice,
  toLegacyParseResult,
  type LegacyParseResult,
  type VoiceParseResult,
} from './voice/index.ts';
import type { AppLanguage } from './preferences/types.ts';
import { preferencesStore } from './preferences/PreferencesStore.ts';

export { CHESS_CONTEXT_STRINGS };
export { normalizeTranscript as normalize };
export type { VoiceParseResult, LegacyParseResult as ParseResult };

export const PIECE_CHARS: Record<string, string> = {
  wp: '♙', wn: '♘', wb: '♗', wr: '♖', wq: '♕', wk: '♔',
  bp: '♟', bn: '♞', bb: '♝', br: '♜', bq: '♛', bk: '♚',
};

const FRENCH_PIECE_NAMES: Record<string, string> = {
  p: 'Pion',
  n: 'Cavalier',
  b: 'Fou',
  r: 'Tour',
  q: 'Dame',
  k: 'Roi',
};

const ENGLISH_PIECE_NAMES: Record<string, string> = {
  p: 'Pawn',
  n: 'Knight',
  b: 'Bishop',
  r: 'Rook',
  q: 'Queen',
  k: 'King',
};

function resolveSpeechLanguage(language?: AppLanguage): AppLanguage {
  return language ?? preferencesStore.getPreferences().language;
}

// ── TTS helpers ───────────────────────────────────────────────────────────

/** Spell out a square so TTS says "D 5" not "d5" (avoids "boulevard", etc.). */
function spellSquare(sq: string): string {
  return sq[0].toUpperCase() + ' ' + sq[1];
}

/** Convert a Move object to a verbal description with spelled-out squares. */
export function verbalMove(m: Move, language?: AppLanguage): string {
  const lang = resolveSpeechLanguage(language);
  if (lang === 'en') {
    if (m.flags.includes('k')) return 'Kingside castling';
    if (m.flags.includes('q')) return 'Queenside castling';
    const pieceName = ENGLISH_PIECE_NAMES[m.piece] ?? m.piece;
    let txt = pieceName + ' ';
    if (m.captured) txt += 'takes ';
    else txt += 'to ';
    txt += spellSquare(m.to);
    if (m.promotion) txt += ', promoting to queen';
    return txt;
  }
  if (m.flags.includes('k')) return 'Petit roque';
  if (m.flags.includes('q')) return 'Grand roque';
  const pieceName = FRENCH_PIECE_NAMES[m.piece] ?? m.piece;
  let txt = pieceName + ' ';
  if (m.captured) txt += 'prend ';
  txt += spellSquare(m.to);
  if (m.promotion) txt += ', promotion en dame';
  return txt;
}

/**
 * Convert raw SAN from game.history() into spoken language with spelled squares.
 * Language follows app language preference (independent of chess notation).
 */
export function sanToVerbal(san: string, language?: AppLanguage): string {
  const lang = resolveSpeechLanguage(language);

  if (lang === 'en') {
    if (/^O-O-O$|^0-0-0$/.test(san)) return 'Queenside castling';
    if (/^O-O$|^0-0$/.test(san)) return 'Kingside castling';

    const s = san.replace(/[+#!?]/g, '');
    const PIECES: Record<string, string> = {
      N: 'Knight', B: 'Bishop', R: 'Rook', Q: 'Queen', K: 'King',
    };

    const promoM = s.match(/^([NBRQK]?)([a-h]?)x?([a-h][1-8])=([NBRQK])$/);
    if (promoM) {
      const pn = promoM[1] ? (PIECES[promoM[1]] ?? promoM[1]) : 'Pawn';
      const cap = s.includes('x') ? ' takes' : ' to';
      const promoPiece = (PIECES[promoM[4]] ?? promoM[4]).toLowerCase();
      return `${pn}${cap} ${spellSquare(promoM[3])}, promoting to ${promoPiece}`;
    }

    const mv = s.match(/^([NBRQK]?)([a-h]?[1-8]?)?(x?)([a-h][1-8])$/);
    if (mv) {
      const pieceLetter = mv[1];
      const fromDisambig = mv[2] ?? '';
      const isCapture = !!mv[3];
      const dest = mv[4];
      const pieceName = pieceLetter ? (PIECES[pieceLetter] ?? pieceLetter) : 'Pawn';
      let result = pieceName;
      if (!pieceLetter && fromDisambig) {
        result += ' on ' + fromDisambig.toUpperCase();
      }
      result += isCapture ? ' takes ' : ' to ';
      result += spellSquare(dest);
      return result;
    }
    return s.split('').join(' ');
  }

  if (/^O-O-O$|^0-0-0$/.test(san)) return 'Grand roque';
  if (/^O-O$|^0-0$/.test(san)) return 'Petit roque';

  const s = san.replace(/[+#!?]/g, '');

  const PIECES: Record<string, string> = {
    N: 'Cavalier', B: 'Fou', R: 'Tour', Q: 'Dame', K: 'Roi',
  };

  const promoM = s.match(/^([NBRQK]?)([a-h]?)x?([a-h][1-8])=([NBRQK])$/);
  if (promoM) {
    const pn = promoM[1] ? (PIECES[promoM[1]] ?? promoM[1]) : 'Pion';
    const cap = s.includes('x') ? ' prend' : '';
    const promoPiece = (PIECES[promoM[4]] ?? promoM[4]).toLowerCase();
    return `${pn}${cap} ${spellSquare(promoM[3])}, promotion en ${promoPiece}`;
  }

  const mv = s.match(/^([NBRQK]?)([a-h]?[1-8]?)?(x?)([a-h][1-8])$/);
  if (mv) {
    const pieceLetter = mv[1];
    const fromDisambig = mv[2] ?? '';
    const isCapture = !!mv[3];
    const dest = mv[4];

    const pieceName = pieceLetter ? (PIECES[pieceLetter] ?? pieceLetter) : 'Pion';
    let result = pieceName;

    if (!pieceLetter && fromDisambig) {
      result += ' en ' + fromDisambig.toUpperCase();
    }
    if (isCapture) result += ' prend';
    result += ' ' + spellSquare(dest);
    return result;
  }

  return s.split('').join(' ');
}

/** Produce a status/announcement for end-of-game and check conditions. */
export function gameStateAnnouncement(game: Chess, prefix = ''): string {
  const base = prefix ? prefix + ' ' : '';
  if (game.isCheckmate()) return (base + 'Échec et mat. Partie terminée.').trim();
  if (game.isStalemate()) return (base + 'Pat. Partie nulle.').trim();
  if (game.isThreefoldRepetition()) return (base + 'Partie nulle par répétition.').trim();
  if (game.isInsufficientMaterial()) return (base + 'Partie nulle, matériel insuffisant.').trim();
  if (game.isDraw()) return (base + 'Partie nulle.').trim();
  if (game.isCheck()) return (base + 'Échec.').trim();
  return prefix.trim();
}

/**
 * Parse a raw transcript into a chess move (legacy shape).
 *
 * Prefer `parseChessVoice` from `@/lib/voice` in new code — it returns
 * structured results including commands, ambiguity, and illegal.
 *
 * Ambiguous results no longer force a silent guess: callers should ask the
 * user to clarify when `kind === 'ambiguous'`.
 */
export function parseSpoken(raw: string, game: Chess): LegacyParseResult {
  const result = parseChessVoice(raw, game, { mode: 'any' });
  if (result.type === 'command') {
    return { kind: 'unknown' };
  }
  return toLegacyParseResult(result);
}

/** Full structured parse (moves + mode-agnostic commands). */
export function parseVoice(raw: string, game: Chess): VoiceParseResult {
  return parseChessVoice(raw, game, { mode: 'any' });
}
