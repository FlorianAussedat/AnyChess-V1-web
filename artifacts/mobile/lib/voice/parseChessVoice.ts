/**
 * Top-level chess voice parser.
 *
 * Independent of any speech-recognition provider: pass a raw transcript string
 * (from Web Speech today, native Android later) plus the current Chess position.
 *
 * Pipeline:
 *   raw transcript
 *     → normalize
 *     → app command? (mode-filtered)
 *     → notation-aware SAN (user preference first, alternate as fallback)
 *     → structured intent → legal-move resolve
 *     → fuzzy legal-move fallback
 *     → structured VoiceParseResult
 */
import type { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import { preferencesStore } from '../preferences/PreferencesStore.ts';
import type { ChessNotation } from '../preferences/types.ts';
import { normalizeTranscript } from './normalizeTranscript.ts';
import { parseAppCommand } from './parseAppCommand.ts';
import { describeIntent, extractMoveIntent } from './extractMoveIntent.ts';
import {
  frenchSanToEnglish,
  hasFrenchPiecePrefix,
  resolveAgainstLegalMoves,
  tryDirectSan,
} from './resolveLegalMove.ts';
import { fuzzyMatchLegalMoves } from './fuzzyMatch.ts';
import type {
  LegacyParseResult,
  ParseChessVoiceOptions,
  VoiceParseResult,
} from './types.ts';

function moveResult(
  move: Move,
  confidence: number,
  raw: string,
  normalized: string,
): VoiceParseResult {
  return {
    type: 'move',
    move,
    confidence,
    rawTranscript: raw,
    normalizedTranscript: normalized,
  };
}

function tryFrenchSanConversion(
  compactRaw: string,
  compactNorm: string,
  game: Chess,
  rawTrim: string,
  normalized: string,
): VoiceParseResult | null {
  if (hasFrenchPiecePrefix(compactRaw)) {
    const convertedRaw = frenchSanToEnglish(compactRaw);
    if (convertedRaw !== compactRaw) {
      const fr = tryDirectSan(convertedRaw, game);
      if (fr) return moveResult(fr, 1, rawTrim, normalized);
    }
  }
  const convertedNorm = frenchSanToEnglish(compactNorm);
  if (convertedNorm !== compactNorm) {
    const fr = tryDirectSan(convertedNorm, game);
    if (fr) return moveResult(fr, 1, rawTrim, normalized);
  }
  return null;
}

function tryEnglishSan(
  rawTrim: string,
  compactNorm: string,
  game: Chess,
  normalized: string,
): VoiceParseResult | null {
  const direct = tryDirectSan(rawTrim, game) ?? tryDirectSan(compactNorm, game);
  if (direct) return moveResult(direct, 1, rawTrim, normalized);
  return null;
}

function resolveChessNotation(
  options: ParseChessVoiceOptions,
): ChessNotation {
  if (options.chessNotation === 'fr' || options.chessNotation === 'en') {
    return options.chessNotation;
  }
  return preferencesStore.getPreferences().chessNotation;
}

/**
 * Parse a raw speech / text transcript into a move or app command.
 */
export function parseChessVoice(
  raw: string,
  game: Chess,
  options: ParseChessVoiceOptions = {},
): VoiceParseResult {
  const mode = options.mode ?? 'any';
  const defaultPromotion = options.defaultPromotion ?? 'q';
  const chessNotation = resolveChessNotation(options);
  const normalized = normalizeTranscript(raw);
  const rawTrim = raw.trim();

  if (!normalized) {
    return {
      type: 'unrecognized',
      rawTranscript: rawTrim,
      normalizedTranscript: '',
      reason: 'empty transcript',
    };
  }

  // ── 1. App commands (before chess, so "solution" ≠ a move) ──────────────
  const cmd = parseAppCommand(normalized, mode);
  if (cmd) {
    return {
      type: 'command',
      command: cmd.command,
      confidence: cmd.confidence,
      rawTranscript: rawTrim,
      normalizedTranscript: normalized,
    };
  }

  const compactNorm = normalized.replace(/\s+/g, '');
  const compactRaw = rawTrim.replace(/\s+/g, '');

  // ── 2. Notation-aware SAN ───────────────────────────────────────────────
  // Selected notation always wins when both English rook R and French Roi R
  // are legal (e.g. Rd2). The other system is only a fallback.
  if (chessNotation === 'en') {
    const en = tryEnglishSan(rawTrim, compactNorm, game, normalized);
    if (en) return en;
    const fr = tryFrenchSanConversion(
      compactRaw,
      compactNorm,
      game,
      rawTrim,
      normalized,
    );
    if (fr) return fr;
  } else {
    const fr = tryFrenchSanConversion(
      compactRaw,
      compactNorm,
      game,
      rawTrim,
      normalized,
    );
    if (fr) return fr;
    const en = tryEnglishSan(rawTrim, compactNorm, game, normalized);
    if (en) return en;
  }

  // ── 3. Structured intent + legal moves ──────────────────────────────────
  const intent = extractMoveIntent(normalized);
  if (intent) {
    // Default queen promotion when pawn hits last rank without one
    if (!intent.promotion && intent.to && /^[a-h][18]$/.test(intent.to)) {
      const isPawnish = !intent.piece || intent.piece === 'p';
      if (isPawnish) intent.promotion = defaultPromotion;
    }

    const resolved = resolveAgainstLegalMoves(game, intent, defaultPromotion);
    if (resolved.status === 'unique') {
      return moveResult(resolved.move, resolved.confidence, rawTrim, normalized);
    }
    if (resolved.status === 'ambiguous') {
      return {
        type: 'ambiguous',
        candidates: resolved.candidates,
        rawTranscript: rawTrim,
        normalizedTranscript: normalized,
        reason: 'multiple legal moves match',
      };
    }
    if (resolved.status === 'illegal') {
      return {
        type: 'illegal',
        rawTranscript: rawTrim,
        normalizedTranscript: normalized,
        reason: 'understood but illegal in position',
        intendedDescription: resolved.description,
      };
    }
  }

  // ── 4. Fuzzy fallback against legal moves ───────────────────────────────
  const legal = game.moves({ verbose: true }) as Move[];
  const fuzzy = fuzzyMatchLegalMoves(normalized, legal);
  if (fuzzy.status === 'unique') {
    return moveResult(fuzzy.move, fuzzy.confidence, rawTrim, normalized);
  }
  if (fuzzy.status === 'ambiguous') {
    return {
      type: 'ambiguous',
      candidates: fuzzy.candidates,
      rawTranscript: rawTrim,
      normalizedTranscript: normalized,
      reason: 'multiple legal moves match equally',
    };
  }

  // Intent existed but resolve returned none, and fuzzy failed
  if (intent && (intent.to || intent.castle || intent.piece)) {
    return {
      type: 'illegal',
      rawTranscript: rawTrim,
      normalizedTranscript: normalized,
      reason: 'understood but illegal in position',
      intendedDescription: describeIntent(intent),
    };
  }

  return {
    type: 'unrecognized',
    rawTranscript: rawTrim,
    normalizedTranscript: normalized,
    reason: 'no confident chess interpretation',
  };
}

/**
 * Legacy adapter preserving the historical `parseSpoken` result shape.
 * Maps the structured VoiceParseResult into kind: move | ambiguous | illegal | unknown.
 */
export function toLegacyParseResult(result: VoiceParseResult): LegacyParseResult {
  switch (result.type) {
    case 'move':
      return { kind: 'move', move: result.move };
    case 'ambiguous':
      return {
        kind: 'ambiguous',
        guess: result.candidates[0],
        candidates: result.candidates,
      };
    case 'illegal':
      return { kind: 'illegal', reason: result.reason };
    case 'command':
      // Commands should be handled before calling this adapter.
      return { kind: 'unknown' };
    case 'unrecognized':
    default:
      return { kind: 'unknown' };
  }
}

/**
 * Convenience: parse moves only (commands ignored / returned as unknown).
 * Prefer `parseChessVoice` with an explicit mode in new code.
 */
export function parseSpokenMove(raw: string, game: Chess): LegacyParseResult {
  const result = parseChessVoice(raw, game, { mode: 'any' });
  if (result.type === 'command') return { kind: 'unknown' };
  return toLegacyParseResult(result);
}