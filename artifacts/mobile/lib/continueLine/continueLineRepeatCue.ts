/**
 * Pure helpers for Continue-la-ligne « Répéter » playback.
 * No auto-speak on mount — the screen calls these only when the user taps Répéter.
 */
import { sanToVerbal } from '../chessParser.ts';
import { continueLineNotationDisplay } from './continueLineNotationDisplay.ts';
import { voiceSpeedToRate } from './voiceSpeed.ts';

export type ContinueLineRepeatCueInput = {
  preambleSans: readonly string[];
  recitedSans: readonly string[];
  correctCount: number;
  trainingSide?: 'white' | 'black';
};

/**
 * SANs that should be spoken for Répéter (start line or position reached).
 * Empty when there is no reference line yet (start from move 1).
 */
export function continueLineRepeatSans(input: ContinueLineRepeatCueInput): string[] {
  const notation = continueLineNotationDisplay(
    input.preambleSans,
    input.recitedSans,
    input.correctCount,
  );
  return notation.sans;
}

/**
 * French verbal cue for Répéter from the authoritative session snapshot fields.
 */
export function continueLineRepeatVerbalCue(input: ContinueLineRepeatCueInput): string {
  const sideHint =
    input.trainingSide === 'white'
      ? ' (Blancs)'
      : input.trainingSide === 'black'
        ? ' (Noirs)'
        : '';
  const sans = continueLineRepeatSans(input);
  if (sans.length === 0) {
    return `Continue la ligne depuis le début${sideHint}.`;
  }
  const verbalLine = sans.map((s) => sanToVerbal(s)).join('. ');
  if (input.correctCount <= 0) {
    return `${verbalLine}. Continue la ligne${sideHint}.`;
  }
  return verbalLine;
}

/** TTS options for a Répéter tap — always flush; rate from current slider. */
export function continueLineRepeatSpeakOptions(voiceSpeed: number): {
  flush: true;
  rate: number;
} {
  return {
    flush: true,
    rate: voiceSpeedToRate(voiceSpeed),
  };
}
