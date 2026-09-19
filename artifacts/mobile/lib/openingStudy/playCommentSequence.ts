import { Chess } from 'chess.js';
import type { CommentToken } from './commentChessTokens.ts';
import { commentSanSequences, englishSanGuess, tokenizeCommentSans } from './commentChessTokens.ts';

export type PlayableSequence = {
  inputSans: string[];
  legalSans: string[];
  fenAfter: string;
};

/** Try to play a SAN sequence from `fen`. Returns null if any ply is illegal. */
export function tryPlaySanSequence(
  fen: string,
  sans: readonly string[],
): PlayableSequence | null {
  if (sans.length === 0) return null;
  const chess = new Chess(fen);
  const legalSans: string[] = [];
  for (const raw of sans) {
    const candidates = uniqueSans(raw);
    let played = null;
    for (const san of candidates) {
      try {
        played = chess.move(san);
      } catch {
        played = null;
      }
      if (played) break;
    }
    if (!played) return null;
    legalSans.push(played.san);
  }
  return { inputSans: [...sans], legalSans, fenAfter: chess.fen() };
}

function uniqueSans(raw: string): string[] {
  const cleaned = raw.replace(/^\.\.\./, '').trim();
  const en = englishSanGuess(cleaned);
  return en === cleaned ? [cleaned] : [cleaned, en];
}

/**
 * Mark SAN tokens playable when a legal prefix exists from one of `fens`.
 * Candidate FENs are tried in order (typically after the move, then before).
 */
export function annotatePlayableCommentTokens(
  comment: string,
  fens: string | readonly string[],
): CommentToken[] {
  const tokens = tokenizeCommentSans(comment);
  const fenList = (typeof fens === 'string' ? [fens] : [...fens]).filter(Boolean);
  const sequences = commentSanSequences(tokens);
  const playableByIndex = new Map<number, { sans: string[]; fen: string }>();

  let sanOrdinal = 0;
  const sequenceSpans: { start: number; sans: string[] }[] = [];
  for (const seq of sequences) {
    sequenceSpans.push({ start: sanOrdinal, sans: seq });
    sanOrdinal += seq.length;
  }

  for (const span of sequenceSpans) {
    for (const fen of fenList) {
      for (let len = span.sans.length; len >= 1; len -= 1) {
        const prefix = span.sans.slice(0, len);
        const played = tryPlaySanSequence(fen, prefix);
        if (!played) continue;
        for (let i = 0; i < len; i += 1) {
          const tokIndex = span.start + i;
          if (!playableByIndex.has(tokIndex)) {
            playableByIndex.set(tokIndex, {
              sans: played.legalSans.slice(0, i + 1),
              fen,
            });
          }
        }
        break;
      }
      if (playableByIndex.has(span.start)) break;
    }
  }

  let seen = 0;
  return tokens.map((tok) => {
    if (tok.kind !== 'san') return tok;
    const played = playableByIndex.get(seen);
    seen += 1;
    if (!played) return { ...tok, playable: false };
    return { ...tok, playable: true, playSans: played.sans, startFen: played.fen };
  });
}

export function lastMoveFromSans(
  startFen: string,
  sans: readonly string[],
): { from: string; to: string } | null {
  if (sans.length === 0) return null;
  const chess = new Chess(startFen);
  let last: { from: string; to: string } | null = null;
  for (const san of sans) {
    let played = null;
    for (const candidate of uniqueSans(san)) {
      try {
        played = chess.move(candidate);
      } catch {
        played = null;
      }
      if (played) break;
    }
    if (!played) return last;
    last = { from: played.from, to: played.to };
  }
  return last;
}
