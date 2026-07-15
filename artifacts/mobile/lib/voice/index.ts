/**
 * Chess voice command pipeline — public API.
 *
 * Architecture (provider-agnostic):
 *
 *   Audio capture / Microphone          (SpeechRecognitionService — web today)
 *           ↓
 *   Speech-to-text provider             (Web Speech / future Android)
 *           ↓
 *   Raw transcript                      (string)
 *           ↓
 *   Transcript normalization            (normalizeTranscript)
 *           ↓
 *   Chess Voice Parser                  (parseChessVoice)
 *           ↓
 *   Current position + legal moves      (chess.js)
 *           ↓
 *   Resolved move | app command | ambiguous | illegal | unrecognized
 *           ↓
 *   Game action                         (mode contexts)
 *
 * Future Android STT should call `parseChessVoice(transcript, game, { mode })`
 * with the same signature — no chess parsing rewrite required.
 */

export type {
  AppVoiceCommand,
  LegacyParseResult,
  MoveIntent,
  ParseChessVoiceOptions,
  ResolvedChessMove,
  VoiceMode,
  VoiceParseResult,
} from './types.ts';

export { normalizeTranscript, normalize } from './normalizeTranscript.ts';
export { CHESS_CONTEXT_STRINGS } from './vocabulary.ts';
export { parseAppCommand } from './parseAppCommand.ts';
export { extractMoveIntent, describeIntent } from './extractMoveIntent.ts';
export {
  parseChessVoice,
  parseSpokenMove,
  toLegacyParseResult,
} from './parseChessVoice.ts';
export {
  diagnoseVoiceTranscript,
  formatVoiceDiagnostic,
  type VoiceDiagnostic,
} from './diagnose.ts';
