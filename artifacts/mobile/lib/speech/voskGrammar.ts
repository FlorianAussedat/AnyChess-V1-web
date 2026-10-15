/**
 * Phrase grammar for the small Vosk models.
 *
 * The list covers every legal move in the current position, in the natural
 * wordings the chess parser already accepts. It is not the exercise's
 * expected move. `[unk]` lets silence and unrelated speech stay unknown.
 *
 * Square tokens such as "f3" are absent from these lexicons, so coordinates
 * are spoken as a file letter plus a rank word ("f trois", "f three").
 */
import { Chess } from 'chess.js';

const FR_RANK = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit'];
const EN_RANK = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
const FR_PIECE: Record<string, string> = {
  k: 'roi',
  q: 'dame',
  r: 'tour',
  b: 'fou',
  n: 'cavalier',
  p: 'pion',
};
const EN_PIECE: Record<string, string> = {
  k: 'king',
  q: 'queen',
  r: 'rook',
  b: 'bishop',
  n: 'knight',
  p: 'pawn',
};
const FR_PROMO: Record<string, string> = {
  q: 'dame',
  r: 'tour',
  b: 'fou',
  n: 'cavalier',
};
const EN_PROMO: Record<string, string> = {
  q: 'queen',
  r: 'rook',
  b: 'bishop',
  n: 'knight',
};

function add(phrases: Set<string>, phrase: string): void {
  const clean = phrase.replace(/\s+/g, ' ').trim();
  if (clean) phrases.add(clean);
}

/**
 * Natural phrases for every legal move, plus `[unk]`.
 * `language` selects French or English wording, not a single expected move.
 */
export function chessPhraseGrammar(fen: string, language: 'fr' | 'en'): string[] {
  const game = new Chess(fen);
  const moves = game.moves({ verbose: true });
  const phrases = new Set<string>();
  let anyCastle = false;
  const rank = language === 'fr' ? FR_RANK : EN_RANK;
  const pieceName = language === 'fr' ? FR_PIECE : EN_PIECE;
  const promoName = language === 'fr' ? FR_PROMO : EN_PROMO;
  const link = language === 'fr' ? 'en' : 'to';
  const capture = language === 'fr' ? 'prend' : 'takes';

  for (const move of moves) {
    if (move.flags.includes('k')) {
      anyCastle = true;
      add(phrases, language === 'fr' ? 'petit roque' : 'short castle');
      continue;
    }
    if (move.flags.includes('q')) {
      anyCastle = true;
      add(phrases, language === 'fr' ? 'grand roque' : 'long castle');
      continue;
    }
    const file = move.to[0];
    const rankWord = rank[Number(move.to[1])] ?? '';
    const name = pieceName[move.piece] ?? '';
    const sameDestination = moves.filter(
      (other) => other.piece === move.piece && other.to === move.to && !other.promotion,
    );
    if (move.piece === 'p' && !move.promotion) {
      add(phrases, `${file} ${rankWord}`);
      add(phrases, `${name} ${file} ${rankWord}`);
      if (move.flags.includes('c') || move.flags.includes('e')) {
        add(phrases, `${move.from[0]} ${capture} ${file} ${rankWord}`);
        add(phrases, `${name} ${move.from[0]} ${capture} ${file} ${rankWord}`);
      }
    } else if (move.promotion) {
      const promo = promoName[move.promotion] ?? '';
      add(phrases, `${file} ${rankWord} ${promo}`);
      add(phrases, `${name} ${file} ${rankWord} ${promo}`);
    } else {
      add(phrases, `${name} ${file} ${rankWord}`);
      add(phrases, `${name} ${link} ${file} ${rankWord}`);
      if (move.flags.includes('c')) {
        add(phrases, `${name} ${capture} ${file} ${rankWord}`);
      }
      if (sameDestination.length > 1) {
        add(phrases, `${name} ${move.from[0]} ${file} ${rankWord}`);
        add(phrases, `${name} ${move.from[0]} ${link} ${file} ${rankWord}`);
        const fromRank = rank[Number(move.from[1])] ?? '';
        add(phrases, `${name} ${move.from[0]} ${fromRank} ${file} ${rankWord}`);
      }
    }
  }

  if (anyCastle && language === 'fr') add(phrases, 'roque');
  if (language === 'fr') {
    add(phrases, 'annule');
    add(phrases, 'repete');
  } else {
    add(phrases, 'undo');
    add(phrases, 'repeat');
  }
  add(phrases, '[unk]');
  return [...phrases];
}

/** Empty grammar restores the model's default graph. Used for non-move dictation. */
export const OPEN_VOSK_GRAMMAR = '[]';
