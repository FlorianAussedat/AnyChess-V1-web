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
/**
 * e and d stay confusable for the small English model even when the lattice
 * keeps both. A move is refused when the other file is still this close:
 * the engine can look sure and still have heard the neighbouring file.
 */
const FILE_PAIR_MARGIN = 0.06;

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
    strict: true,
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

  const accept = (text: string): TranscriptDecision => {
    if (confusablePawnFile(interpret(text), parsed, parsed[0].score, interpret)) {
      return { status: 'reject', reason: 'conflict' };
    }
    return { status: 'accept', text };
  };

  const kept: typeof parsed = [];
  for (const alt of parsed) {
    const dropped = kept.some((better) => isSubsequence(alt.words, better.words));
    if (!dropped) kept.push(alt);
  }

  // A leading unknown or illegal phrase must not lose to a weaker legal move.
  // That was turning "c" or an impossible square into a different legal move.
  // A fragment of at least two words may complete the one close legal phrase
  // it is cut from ("roi deux" beside "roi e deux"). A single word may not:
  // "c" must not become "c five".
  if (interpret(kept[0].text) === 'nomove') {
    if (kept[0].words.length >= 2) {
      const topScore = kept[0].score;
      const near = Math.abs(topScore) * marginRatio;
      const completed = kept.filter((alt) => {
        if (topScore - alt.score > near) return false;
        if (!isSubsequence(kept[0].words, alt.words)) return false;
        const key = interpret(alt.text);
        return key.startsWith('move:') || key.startsWith('command:');
      });
      const keys = [...new Set(completed.map((alt) => interpret(alt.text)))];
      if (keys.length === 1) {
        const chosen = completed.find((alt) => interpret(alt.text) === keys[0]);
        if (chosen) return accept(chosen.text);
      }
    }
    return { status: 'reject', reason: 'empty' };
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
  return accept(chosen.text);
}

function pawnDestination(key: string): { file: string; rank: string } | null {
  if (!key.startsWith('move:')) return null;
  const san = key.slice('move:'.length);
  if (san.startsWith('O-') || /[NBRQK]/.test(san)) return null;
  const squares = [...san.matchAll(/([a-h])([1-8])/g)];
  const dest = squares[squares.length - 1];
  if (!dest) return null;
  return { file: dest[1], rank: dest[2] };
}

function confusablePawnFile(
  key: string,
  alternatives: { text: string; score: number }[],
  bestScore: number,
  interpret: (text: string) => string,
): boolean {
  const chosen = pawnDestination(key);
  if (!chosen || (chosen.file !== 'd' && chosen.file !== 'e')) return false;
  const other = chosen.file === 'd' ? 'e' : 'd';
  const margin = Math.abs(bestScore) * FILE_PAIR_MARGIN;
  return alternatives.some((alt) => {
    if (bestScore - alt.score > margin) return false;
    const square = pawnDestination(interpret(alt.text));
    return square?.file === other && square.rank === chosen.rank;
  });
}

export type DictationAction =
  | { action: 'play'; text: string; key: string }
  | { action: 'repeat' }
  | { action: 'silence' };

function hypothesisText(text: string): string {
  return wordsOf(text).join(' ');
}

/**
 * Play a unique legal move or a voice command. Anything spoken but unclear
 * asks for a repeat. Silence plays nothing and stays quiet.
 */
export function decideDictation(
  alternatives: VoskAlternative[],
  fen: string,
  language: 'fr' | 'en',
): DictationAction {
  const decision = agreeHypotheses(alternatives, (text) =>
    chessInterpretationKey(text, fen, language),
  );
  const spoken = alternatives.some((alt) => hypothesisText(alt.text).length > 0);
  if (decision.status === 'reject') {
    return spoken ? { action: 'repeat' } : { action: 'silence' };
  }
  const key = chessInterpretationKey(decision.text, fen, language);
  if (key.startsWith('move:') || key.startsWith('command:')) {
    return { action: 'play', text: decision.text, key };
  }
  return spoken ? { action: 'repeat' } : { action: 'silence' };
}
