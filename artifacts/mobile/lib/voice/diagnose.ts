/**
 * Dev / test diagnostic for the chess voice parser.
 * No UI dependency — safe to call from tests or a hidden __DEV__ screen.
 */
import type { Chess } from 'chess.js';
import { normalizeTranscript } from './normalizeTranscript.ts';
import { extractMoveIntent, describeIntent } from './extractMoveIntent.ts';
import { parseAppCommand } from './parseAppCommand.ts';
import { parseChessVoice } from './parseChessVoice.ts';
import type { ParseChessVoiceOptions, VoiceParseResult } from './types.ts';

export type VoiceDiagnostic = {
  rawTranscript: string;
  normalizedTranscript: string;
  intentDescription: string | null;
  appCommand: string | null;
  result: VoiceParseResult;
  statusLabel: string;
  confidence: number | null;
  moveSan: string | null;
};

function statusLabel(result: VoiceParseResult): string {
  switch (result.type) {
    case 'move':
      return 'legal';
    case 'command':
      return `command:${result.command}`;
    case 'ambiguous':
      return 'ambiguous';
    case 'illegal':
      return 'illegal';
    case 'unrecognized':
      return 'unrecognized';
  }
}

/**
 * Inspect how a raw transcript is interpreted for the given position.
 */
export function diagnoseVoiceTranscript(
  raw: string,
  game: Chess,
  options: ParseChessVoiceOptions = {},
): VoiceDiagnostic {
  const normalized = normalizeTranscript(raw);
  const intent = extractMoveIntent(normalized);
  const cmd = parseAppCommand(normalized, options.mode ?? 'any');
  const result = parseChessVoice(raw, game, options);

  let confidence: number | null = null;
  let moveSan: string | null = null;
  if (result.type === 'move') {
    confidence = result.confidence;
    moveSan = result.move.san;
  } else if (result.type === 'command') {
    confidence = result.confidence;
  } else if (result.type === 'ambiguous' && result.candidates[0]) {
    moveSan = result.candidates.map((m) => m.san).join(' | ');
  } else if (result.type === 'illegal') {
    moveSan = result.intendedDescription ?? null;
  }

  return {
    rawTranscript: raw,
    normalizedTranscript: normalized,
    intentDescription: intent ? describeIntent(intent) : null,
    appCommand: cmd?.command ?? null,
    result,
    statusLabel: statusLabel(result),
    confidence,
    moveSan,
  };
}

/** Format a diagnostic as multi-line plain text (CLI / console). */
export function formatVoiceDiagnostic(d: VoiceDiagnostic): string {
  const lines = [
    `Raw:          ${JSON.stringify(d.rawTranscript)}`,
    `Normalized:   ${JSON.stringify(d.normalizedTranscript)}`,
    `Intent:       ${d.intentDescription ?? '(none)'}`,
    `App command:  ${d.appCommand ?? '(none)'}`,
    `Status:       ${d.statusLabel}`,
    `Result move:  ${d.moveSan ?? '(n/a)'}`,
    `Confidence:   ${d.confidence ?? '(n/a)'}`,
  ];
  return lines.join('\n');
}
