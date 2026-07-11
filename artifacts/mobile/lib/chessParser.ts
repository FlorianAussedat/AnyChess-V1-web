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
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,;:!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // English piece names → French for unified matching
    .replace(/\bknight\b/g, 'cavalier')
    .replace(/\bbishop\b/g, 'fou')
    .replace(/\brook\b/g, 'tour')
    .replace(/\bqueen\b/g, 'dame')
    .replace(/\bking\b/g, 'roi')
    .replace(/\bpawn\b/g, 'pion')
    // English actions
    .replace(/\btakes\b/g, 'prend')
    .replace(/\bcaptures\b/g, 'prend')
    // French synonyms
    .replace(/\bfois\b/g, 'prend')
    .replace(/\bx\b/g, 'prend')
    // Numbers spoken aloud
    .replace(/\bquatre\b/g, '4')
    .replace(/\bcinq\b/g, '5')
    .replace(/\bsix\b/g, '6')
    .replace(/\bsept\b/g, '7')
    .replace(/\bhuit\b/g, '8')
    .replace(/\bdeux\b/g, '2')
    .replace(/\btrois\b/g, '3')
    .replace(/\bun\b/g, '1');
}

/** Convert a move to a French verbal description. */
export function verbalMove(m: Move): string {
  if (m.flags.includes('k')) return 'Petit roque';
  if (m.flags.includes('q')) return 'Grand roque';
  const pieceName = FRENCH_PIECE_NAMES[m.piece] ?? m.piece;
  let txt = pieceName + ' ';
  if (m.captured) txt += 'prend ';
  txt += m.to;
  if (m.promotion) txt += ', promotion en dame';
  return txt;
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

  if (!ranked.length || ranked[0].score < 0.72) return { kind: 'unknown' };

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
