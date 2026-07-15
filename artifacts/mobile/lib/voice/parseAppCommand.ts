/**
 * Application voice-command recognition (undo, solution, repeat, …).
 * Kept separate from chess move parsing so commands are never mistaken for moves.
 */
import type { AppVoiceCommand, VoiceMode } from './types.ts';

type CommandMatch = {
  command: AppVoiceCommand;
  confidence: number;
};

/** Commands allowed per mode. `'any'` accepts the full set. */
const MODE_COMMANDS: Record<VoiceMode, ReadonlySet<AppVoiceCommand>> = {
  classic: new Set(['undo', 'repeat', 'summarize']),
  opening: new Set(['undo', 'repeat', 'summarize']),
  puzzle: new Set(['solution', 'repeat_position']),
  blind: new Set([]),
  any: new Set(['undo', 'repeat', 'repeat_position', 'summarize', 'solution']),
};

/**
 * Try to interpret a normalized transcript as an app command.
 * Returns null when the transcript is not a command (or not allowed in mode).
 */
export function parseAppCommand(
  normalized: string,
  mode: VoiceMode = 'any',
): CommandMatch | null {
  const allowed = MODE_COMMANDS[mode];

  // Solution — puzzle only (or any)
  if (
    allowed.has('solution') &&
    (/\bsolution\b/.test(normalized) ||
      /\bla\s+solution\b/.test(normalized) ||
      /\bmontre\s+la\s+solution\b/.test(normalized) ||
      /\bshow\s+(the\s+)?solution\b/.test(normalized))
  ) {
    return { command: 'solution', confidence: 1 };
  }

  // Repeat position — puzzle (more specific than bare "répète")
  if (
    allowed.has('repeat_position') &&
    (/\brepete\s+la\s+position\b/.test(normalized) ||
      /\brepeter\s+la\s+position\b/.test(normalized) ||
      /\brepete\s+position\b/.test(normalized) ||
      /\brepeat\s+(the\s+)?position\b/.test(normalized))
  ) {
    return { command: 'repeat_position', confidence: 1 };
  }

  // Undo / cancel
  if (
    allowed.has('undo') &&
    (/\b(annule|annuler|annulee?)\b/.test(normalized) ||
      /\bundo\b/.test(normalized) ||
      /\bcancel\b/.test(normalized))
  ) {
    return { command: 'undo', confidence: 1 };
  }

  // Summarize game history
  if (allowed.has('summarize') && /\bresum/.test(normalized)) {
    return { command: 'summarize', confidence: 0.95 };
  }

  // Bare repeat / répète (classic & opening TTS replay)
  if (
    allowed.has('repeat') &&
    (/\brepete\b/.test(normalized) || /\brepeat\b/.test(normalized))
  ) {
    return { command: 'repeat', confidence: 1 };
  }

  return null;
}
