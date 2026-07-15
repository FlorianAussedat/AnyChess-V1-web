/**
 * Soft fuzzy fallback: score normalized transcript against verbal forms of
 * each legal move. Used when structured intent extraction fails or is weak.
 *
 * Conservative — requires a reasonably high score and clear separation from
 * the runner-up to avoid guessing among ambiguous moves.
 */
import type { Move } from 'chess.js';
import { normalizeTranscript } from './normalizeTranscript.ts';

function spokenCandidates(move: Move): string[] {
  const names: Record<string, string[]> = {
    p: ['pion', 'pawn', ''],
    n: ['cavalier', 'knight'],
    b: ['fou', 'bishop'],
    r: ['tour', 'rook'],
    q: ['dame', 'queen'],
    k: ['roi', 'king'],
  };
  if (move.flags.includes('k')) {
    return ['petit roque', 'roque cote roi', 'kingside castle', 'short castle', 'o-o'];
  }
  if (move.flags.includes('q')) {
    return ['grand roque', 'roque cote dame', 'queenside castle', 'long castle', 'o-o-o'];
  }
  const out: string[] = [];
  for (const name of names[move.piece] ?? []) {
    const middles = move.captured
      ? [' prend ', ' capture ', ' takes ', ' x ']
      : [' ', ' en ', ' to '];
    for (const middle of middles) {
      out.push(normalizeTranscript((name ? name + middle : '') + move.to));
      // With origin file disambiguation
      out.push(
        normalizeTranscript(
          (name ? name + ' ' : '') + move.from[0] + (move.captured ? ' prend ' : ' ') + move.to,
        ),
      );
      out.push(normalizeTranscript((name ? name + ' ' : '') + move.from + ' ' + move.to));
    }
  }
  // SAN-like short forms
  const sanPiece: Record<string, string[]> = {
    n: ['n', 'c'],
    b: ['b', 'f'],
    r: ['r', 't'],
    q: ['q', 'd'],
    k: ['k', 'r'],
    p: [''],
  };
  for (const letter of sanPiece[move.piece] ?? []) {
    const cap = move.captured ? 'x' : '';
    out.push(normalizeTranscript(`${letter}${cap}${move.to}`));
    out.push(normalizeTranscript(`${letter}${move.from[0]}${cap}${move.to}`));
  }
  return [...new Set(out.filter(Boolean))];
}

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const aa = a.split(' ').filter(Boolean);
  const bb = b.split(' ').filter(Boolean);
  const common = aa.filter((x) => bb.includes(x)).length;
  let score = common / Math.max(aa.length, bb.length, 1);
  const sqA = (a.match(/[a-h][1-8]/) ?? [])[0];
  const sqB = (b.match(/[a-h][1-8]/) ?? [])[0];
  if (sqA && sqB) score += sqA === sqB ? 0.45 : -0.25;
  // Piece-name token bonus
  const pieces = [
    'cavalier',
    'knight',
    'fou',
    'bishop',
    'tour',
    'rook',
    'dame',
    'queen',
    'roi',
    'king',
    'pion',
    'pawn',
  ];
  for (const p of pieces) {
    if (aa.includes(p) && bb.includes(p)) score += 0.15;
  }
  return score;
}

export type FuzzyResult =
  | { status: 'unique'; move: Move; confidence: number }
  | { status: 'ambiguous'; candidates: Move[] }
  | { status: 'none' };

const MIN_SCORE = 0.55;
const AMBIGUITY_GAP = 0.12;

/**
 * Rank legal moves by spoken-form similarity to the normalized transcript.
 */
export function fuzzyMatchLegalMoves(
  normalized: string,
  legal: Move[],
): FuzzyResult {
  const ranked: Array<{ m: Move; score: number }> = [];

  for (const m of legal) {
    let best = 0;
    for (const c of spokenCandidates(m)) {
      best = Math.max(best, similarity(normalized, c));
    }
    if (best > 0) ranked.push({ m, score: best });
  }

  ranked.sort((a, b) => b.score - a.score);
  if (!ranked.length || ranked[0].score < MIN_SCORE) return { status: 'none' };

  const top = ranked[0];
  const sameScore = ranked.filter(
    (x) =>
      Math.abs(x.score - top.score) < AMBIGUITY_GAP &&
      (x.m.from !== top.m.from || x.m.to !== top.m.to || x.m.promotion !== top.m.promotion),
  );

  // Also consider near-ties at the top
  const near = ranked.filter((x) => top.score - x.score < AMBIGUITY_GAP && x.score >= MIN_SCORE);
  const uniqNear = [
    ...new Map(near.map((x) => [`${x.m.from}${x.m.to}${x.m.promotion ?? ''}`, x.m])).values(),
  ];

  if (uniqNear.length > 1 && top.score < 1) {
    return { status: 'ambiguous', candidates: uniqNear };
  }

  if (sameScore.length > 0 && top.score < 1) {
    const candidates = [
      top.m,
      ...sameScore.map((x) => x.m),
    ];
    const uniq = [
      ...new Map(candidates.map((m) => [`${m.from}${m.to}${m.promotion ?? ''}`, m])).values(),
    ];
    if (uniq.length > 1) return { status: 'ambiguous', candidates: uniq };
  }

  return { status: 'unique', move: top.m, confidence: Math.min(1, top.score) };
}
