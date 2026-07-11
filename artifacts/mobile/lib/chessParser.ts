/**
 * French + English voice/text parsing for chess moves.
 * Accepts: French voice, French SAN (Cc3, Fd4, Td8, Dd5),
 *          English SAN (Nc3, Bd4, Rd8, Qd5, Nxe5, cxd4),
 *          and natural language in both languages.
 */
import { Chess } from 'chess.js';
import type { Move } from 'chess.js';

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

const CAPTURE_VALUES: Record<string, number> = {
  p: 1, n: 3, b: 3, r: 5, q: 9,
};

/** Normalize spoken French/English text for fuzzy matching. */
export function normalize(s: string): string {
  const n = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,;:!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // ── STT corruption fixes (must run before piece-name mapping) ───────────
    .replace(/\bdamage\b/g, 'dame')
    .replace(/\bdam\b/g, 'dame')
    .replace(/\bdoms?\b/g, 'dame')
    .replace(/\bdames\b/g, 'dame')
    .replace(/\bcavalerie\b/g, 'cavalier')
    .replace(/\bcavaliers\b/g, 'cavalier')
    .replace(/\bfous\b/g, 'fou')
    .replace(/\bfoul\b/g, 'fou')
    .replace(/\btours\b/g, 'tour')
    .replace(/\bpions\b/g, 'pion')
    // ── English piece names → French ─────────────────────────────────────────
    .replace(/\bknight\b/g, 'cavalier')
    .replace(/\bbishop\b/g, 'fou')
    .replace(/\brook\b/g, 'tour')
    .replace(/\bqueen\b/g, 'dame')
    .replace(/\bking\b/g, 'roi')
    .replace(/\bpawn\b/g, 'pion')
    // ── English actions ───────────────────────────────────────────────────────
    .replace(/\btakes\b/g, 'prend')
    .replace(/\bcaptures\b/g, 'prend')
    // ── French synonyms ───────────────────────────────────────────────────────
    .replace(/\bfois\b/g, 'prend')
    .replace(/\bx\b/g, 'prend')
    // ── Numbers spoken aloud ──────────────────────────────────────────────────
    .replace(/\bquatre\b/g, '4')
    .replace(/\bcinq\b/g, '5')
    .replace(/\bsix\b/g, '6')
    .replace(/\bsept\b/g, '7')
    .replace(/\bhuit\b/g, '8')
    .replace(/\bdeux\b/g, '2')
    .replace(/\btrois\b/g, '3')
    .replace(/\bun\b/g, '1');

  // ── Context-aware phonetic file-letter recovery ───────────────────────────
  // When the user says "Dame D 4", STT may transcribe the file letter as a
  // French word ("de", "et", "effe"…). Recover the letter only when it
  // appears right after a piece name / "prend", so we don't corrupt ordinary
  // French sentences.
  const PIECE_WORDS = '(?:dame|cavalier|fou|tour|roi|pion|prend)';
  return n
    // After a piece word, replace phonetic letter + rank digit
    .replace(new RegExp(`\\b(${PIECE_WORDS})\\s+(de|des|du)\\s+([1-8])\\b`, 'g'), '$1 d$3')
    .replace(new RegExp(`\\b(${PIECE_WORDS})\\s+(et|est|eh)\\s+([1-8])\\b`, 'g'), '$1 e$3')
    .replace(new RegExp(`\\b(${PIECE_WORDS})\\s+(effe|eff|ef|aif)\\s+([1-8])\\b`, 'g'), '$1 f$3')
    .replace(new RegExp(`\\b(${PIECE_WORDS})\\s+(ge|gee|je|jai|j'ai)\\s+([1-8])\\b`, 'g'), '$1 g$3')
    .replace(new RegExp(`\\b(${PIECE_WORDS})\\s+(ache|aiche|ha)\\s+([1-8])\\b`, 'g'), '$1 h$3')
    .replace(new RegExp(`\\b(${PIECE_WORDS})\\s+(be|bi|bais)\\s+([1-8])\\b`, 'g'), '$1 b$3')
    .replace(new RegExp(`\\b(${PIECE_WORDS})\\s+(ce|se|sa|ça)\\s+([1-8])\\b`, 'g'), '$1 c$3')
    .replace(new RegExp(`\\b(${PIECE_WORDS})\\s+(a|ah)\\s+([1-8])\\b`, 'g'), '$1 a$3')
    // Pawn moves: phonetic letter at start of string followed immediately by rank
    .replace(/^(de|des|du)\s+([1-8])$/, 'd$2')
    .replace(/^(et|est)\s+([1-8])$/, 'e$2')
    .replace(/^(effe|ef|eff)\s+([1-8])$/, 'f$2')
    .replace(/^(ge|gee|je)\s+([1-8])$/, 'g$2')
    .replace(/^(ache|ha)\s+([1-8])$/, 'h$2')
    // Collapse any stray spaces that appeared between a letter and its digit
    .replace(/\b([a-h])\s+([1-8])\b/g, '$1$2');
}

/**
 * Full chess vocabulary list for STT contextual hints.
 * Pass this to `contextualStrings` when starting recognition to bias
 * the engine toward chess terms and square names.
 */
export const CHESS_CONTEXT_STRINGS: string[] = [
  // Pieces (French)
  'dame', 'cavalier', 'fou', 'tour', 'roi', 'pion',
  // Pieces (English)
  'queen', 'knight', 'bishop', 'rook', 'king', 'pawn',
  // Special moves
  'petit roque', 'grand roque', 'roque', 'promotion',
  // Actions
  'prend', 'en passant', 'échec', 'mat', 'échec et mat',
  // All 64 squares
  ...['a','b','c','d','e','f','g','h'].flatMap(f =>
    ['1','2','3','4','5','6','7','8'].map(r => f + r)
  ),
];

/** Spell out a square so TTS says "D 5" not "d5" (avoids "boulevard", etc.). */
function spellSquare(sq: string): string {
  return sq[0].toUpperCase() + ' ' + sq[1];
}

/** Convert a move to a French verbal description with spelled-out squares. */
export function verbalMove(m: Move): string {
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
 * Convert raw SAN from game.history() (e.g. "Bd5", "Qd8", "Nxf3", "O-O",
 * "cxd4") into spoken French with each file letter spelled out individually.
 * Prevents TTS from reading "Bd5" as "boulevard cinq" or "Qd8" as "quand huit".
 */
export function sanToVerbal(san: string): string {
  // Castling
  if (/^O-O-O$|^0-0-0$/.test(san)) return 'Grand roque';
  if (/^O-O$|^0-0$/.test(san))     return 'Petit roque';

  // Strip check / checkmate / annotation symbols
  const s = san.replace(/[+#!?]/g, '');

  const PIECES: Record<string, string> = {
    N: 'Cavalier', B: 'Fou', R: 'Tour', Q: 'Dame', K: 'Roi',
  };

  // Promotion: e.g. "e8=Q", "exd8=N"
  const promoM = s.match(/^([NBRQK]?)([a-h]?)x?([a-h][1-8])=([NBRQK])$/);
  if (promoM) {
    const pn = promoM[1] ? (PIECES[promoM[1]] ?? promoM[1]) : 'Pion';
    const cap = s.includes('x') ? ' prend' : '';
    const promoPiece = (PIECES[promoM[4]] ?? promoM[4]).toLowerCase();
    return `${pn}${cap} ${spellSquare(promoM[3])}, promotion en ${promoPiece}`;
  }

  // Standard move: [Piece?][from_disambig?][x?][dest]
  const mv = s.match(/^([NBRQK]?)([a-h]?[1-8]?)?(x?)([a-h][1-8])$/);
  if (mv) {
    const pieceLetter  = mv[1];
    const fromDisambig = mv[2] ?? '';
    const isCapture    = !!mv[3];
    const dest         = mv[4];

    const pieceName = pieceLetter ? (PIECES[pieceLetter] ?? pieceLetter) : 'Pion';
    let result = pieceName;

    // Pawn capture: departure file is the disambiguation
    if (!pieceLetter && fromDisambig) {
      result += ' en ' + fromDisambig.toUpperCase();
    }
    if (isCapture) result += ' prend';
    result += ' ' + spellSquare(dest);
    return result;
  }

  // Fallback: spell each character
  return s.split('').join(' ');
}

/** Produce a status message for end-of-game and check conditions. */
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

// ── Direct SAN parsing ────────────────────────────────────────────────────

/**
 * Try to parse `input` as a SAN move on a clone of `game`.
 * Returns the matching legal Move object from the original game, or null.
 */
function trySAN(input: string, game: Chess): Move | null {
  const clean = input.trim().replace(/\s+/g, '');
  if (!clean) return null;
  // Try both the original input and a lowercase version.
  // chess.js requires lowercase file letters for pawn moves (e.g. "d5" not "D5").
  const attempts = clean === clean.toLowerCase() ? [clean] : [clean, clean.toLowerCase()];
  for (const attempt of attempts) {
    try {
      const clone = new Chess(game.fen());
      const played = clone.move(attempt);
      if (!played) continue;
      const legal = game.moves({ verbose: true }) as Move[];
      const found = legal.find(m => m.from === played.from && m.to === played.to);
      if (found) return found;
    } catch { /* try next */ }
  }
  return null;
}

/**
 * Convert French SAN notation to English SAN so chess.js can parse it.
 *   C → N  (Cavalier → kNight)
 *   F → B  (Fou → Bishop)
 *   T → R  (Tour → Rook)
 *   D → Q  (Dame → Queen)
 *   R → K  (Roi → King) — only when followed by a valid square/capture
 * Also normalises "×" and spaced captures to "x".
 */
function frSANtoEN(raw: string): string {
  return raw
    .replace(/×/g, 'x')
    .replace(/\s*x\s*/g, 'x')
    .replace(/^C(?=[a-h1-8x])/i, 'N')
    .replace(/^F(?=[a-h1-8x])/i, 'B')
    .replace(/^T(?=[a-h1-8x])/i, 'R')
    .replace(/^D(?=[a-h1-8x])/i, 'Q')
    // R for Roi/King — only when the result is a plausible King move (Rx is capture for rook in EN, not desired)
    .replace(/^R(?=[a-h][1-8][+#]?$)/i, 'K');
}

// ── Fuzzy French / English voice matching ────────────────────────────────

/** Generate the set of French spoken strings that could describe a move. */
function spokenCandidates(move: Move): string[] {
  const names: Record<string, string[]> = {
    p: ['pion', ''],
    n: ['cavalier', 'knight'],
    b: ['fou', 'bishop'],
    r: ['tour', 'rook'],
    q: ['dame', 'queen'],
    k: ['roi', 'king'],
  };
  if (move.flags.includes('k')) return ['petit roque', 'roque cote roi', 'kingside castle', 'short castle'];
  if (move.flags.includes('q')) return ['grand roque', 'roque cote dame', 'queenside castle', 'long castle'];
  const out: string[] = [];
  for (const name of names[move.piece] ?? []) {
    const middles = move.captured
      ? [' prend ', ' capture ', ' takes ', ' x ']
      : [' ', ' en '];
    for (const middle of middles) {
      out.push(normalize((name ? name + middle : '') + move.to));
    }
  }
  return [...new Set(out)];
}

/** Fuzzy similarity score between two normalized strings. */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const aa = a.split(' ');
  const bb = b.split(' ');
  const common = aa.filter(x => bb.includes(x)).length;
  let score = common / Math.max(aa.length, bb.length);
  const sqA = (a.match(/[a-h][1-8]/) ?? [])[0];
  const sqB = (b.match(/[a-h][1-8]/) ?? [])[0];
  if (sqA && sqB) score += sqA === sqB ? 0.45 : -0.25;
  return score;
}

export type ParseResult =
  | { kind: 'move'; move: Move }
  | { kind: 'ambiguous'; guess: Move }
  | { kind: 'unknown' };

/**
 * Parse a raw French/English spoken/typed string into a chess move.
 *
 * Strategy:
 *  1. Direct English SAN (Nc3, Bxe5, O-O, cxd4, …)
 *  2. French SAN converted to English (Cc3, Fd5, Txe8, …)
 *  3. Fuzzy French/English voice matching
 */
export function parseSpoken(raw: string, game: Chess): ParseResult {
  const clean = raw.trim();

  // 1. Try direct SAN (handles English notation and standard algebraic)
  const direct = trySAN(clean, game);
  if (direct) return { kind: 'move', move: direct };

  // 2. Try French SAN → English conversion
  const converted = frSANtoEN(clean);
  if (converted !== clean) {
    const fr = trySAN(converted, game);
    if (fr) return { kind: 'move', move: fr };
  }

  // 3. Fuzzy voice / natural language matching
  const input = normalize(raw);
  const legal = game.moves({ verbose: true }) as Move[];
  const ranked: Array<{ m: Move; score: number }> = [];

  for (const m of legal) {
    for (const c of spokenCandidates(m)) {
      ranked.push({ m, score: similarity(input, c) });
    }
  }

  ranked.sort((a, b) => b.score - a.score);

  if (!ranked.length || ranked[0].score < 0.55) return { kind: 'unknown' };

  const top = ranked[0];
  const second = ranked.find(
    x => x.m.from !== top.m.from || x.m.to !== top.m.to,
  );

  if (second && top.score - second.score < 0.12 && top.score < 1) {
    return { kind: 'ambiguous', guess: top.m };
  }

  return { kind: 'move', move: top.m };
}

/**
 * AI opponent: picks one of the top-5 moves biased toward captures and checks.
 * Intentionally non-deterministic — not an engine.
 */
export function pickOpponentMove(game: Chess): Move | null {
  const moves = game.moves({ verbose: true }) as Move[];
  if (!moves.length) return null;

  const scored = moves.map(m => {
    let s = Math.random() * 3;
    if (m.captured) s += (CAPTURE_VALUES[m.captured] ?? 0) * 2;
    try {
      const clone = new Chess(game.fen());
      clone.move({ from: m.from, to: m.to, promotion: 'q' });
      if (clone.isCheck()) s += 4;
    } catch { /* ignore */ }
    return { m, s };
  });

  scored.sort((a, b) => b.s - a.s);
  const pool = scored.slice(0, Math.min(5, scored.length));
  return pool[Math.floor(Math.random() * pool.length)].m;
}
