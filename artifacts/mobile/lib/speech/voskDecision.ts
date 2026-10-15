import { Chess } from 'chess.js';
import { parseChessVoice } from '../voice/parseChessVoice.ts';

/**
 * Choose one transcript from Vosk alternatives, or refuse.
 *
 * A move is accepted only when every close hypothesis is that same result
 * or not a chess result. Several different moves, or a move beside an
 * ambiguity, stay unresolved so the game never plays an arbitrary one.
 *
 * A lower hypothesis that only drops words from a higher one is ignored:
 * "f three" does not cancel "knight f three".
 */

export type VoskAlternative = {
  text: string;
  /** Acoustic score. Higher is better. The scale is not a probability. */
  score: number;
};

export type TranscriptDecision =
  | { status: 'accept'; text: string }
  | { status: 'reject'; reason: 'empty' | 'conflict' };

const DEFAULT_MARGIN_RATIO = 0.03;

function wordsOf(text: string): string[] {
  return text
    .replace(/\[unk\]/gi, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 0);
}

function isSubsequence(shorter: string[], longer: string[]): boolean {
  if (shorter.length === 0 || shorter.length >= longer.length) return false;
  let index = 0;
  for (const word of longer) {
    if (word === shorter[index]) index += 1;
    if (index === shorter.length) return true;
  }
  return false;
}

/**
 * `interpret` maps a transcript to a stable result key such as `move:Nf3`,
 * `ambiguous`, `command:undo`, or `nomove`.
 */
export function chessInterpretationKey(
  text: string,
  fen: string,
  language: 'fr' | 'en',
): string {
  const result = parseChessVoice(text, new Chess(fen), {
    mode: 'any',
    chessNotation: language,
  });
  if (result.type === 'move') return `move:${result.move.san.replace(/[+#]/g, '')}`;
  if (result.type === 'ambiguous') return 'ambiguous';
  if (result.type === 'command') return `command:${result.command}`;
  return 'nomove';
}

export function agreeHypotheses(
  alternatives: VoskAlternative[],
  interpret: (text: string) => string,
  marginRatio = DEFAULT_MARGIN_RATIO,
): TranscriptDecision {
  const parsed = alternatives
    .map((alt) => {
      const text = wordsOf(alt.text).join(' ');
      return { text, score: alt.score, words: wordsOf(alt.text) };
    })
    .sort((a, b) => b.score - a.score);

  if (parsed.length === 0 || parsed[0].text.length === 0) {
    return { status: 'reject', reason: 'empty' };
  }

  const kept: typeof parsed = [];
  for (const alt of parsed) {
    const dropped = kept.some((better) => isSubsequence(alt.words, better.words));
    if (!dropped) kept.push(alt);
  }

  const top = kept[0].score;
  const margin = Math.abs(top) * marginRatio;
  const window = kept.filter((alt) => top - alt.score <= margin);
  const keyed = window.map((alt) => ({ ...alt, key: interpret(alt.text) }));
  const chessKeys = [...new Set(keyed.map((alt) => alt.key).filter((key) => key !== 'nomove'))];

  if (chessKeys.length === 0) return { status: 'reject', reason: 'empty' };
  if (chessKeys.length > 1) return { status: 'reject', reason: 'conflict' };

  const chosen = keyed.find((alt) => alt.key === chessKeys[0]);
  if (!chosen) return { status: 'reject', reason: 'empty' };
  return { status: 'accept', text: chosen.text };
}
