/**
 * French voice parsing for chess moves.
 * Ported from the original HTML prototype.
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

/** Normalize spoken French text for fuzzy matching. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,;:!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\bfois\b/g, 'prend')
    .replace(/\bx\b/g, 'prend')
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

/** Generate the set of French spoken strings that could describe a move. */
function spokenCandidates(move: Move): string[] {
  const names: Record<string, string[]> = {
    p: ['pion', ''],
    n: ['cavalier'],
    b: ['fou'],
    r: ['tour'],
    q: ['dame'],
    k: ['roi'],
  };
  if (move.flags.includes('k')) return ['petit roque', 'roque cote roi'];
  if (move.flags.includes('q')) return ['grand roque', 'roque cote dame'];
  const out: string[] = [];
  for (const name of names[move.piece] ?? []) {
    const middles = move.captured
      ? [' prend ', ' capture ']
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

/** Parse a raw French spoken/typed string into a chess move. */
export function parseSpoken(raw: string, game: Chess): ParseResult {
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
