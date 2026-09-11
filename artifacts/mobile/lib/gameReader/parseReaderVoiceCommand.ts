/**
 * Pure Lecteur voice-command parser (no microphone).
 * Accepts natural French/English phrases; not exact string equality.
 */
export type ReaderVoiceCommand =
  | { type: 'repeatMoves'; count: number; repetitions: number }
  | { type: 'repeatAll' }
  | { type: 'restart' }
  | { type: 'continue' }
  | { type: 'pause' }
  | { type: 'nextMove' }
  | { type: 'previousMove' };

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const WORD_NUM: Record<string, number> = {
  un: 1, une: 1, one: 1,
  deux: 2, two: 2,
  trois: 3, three: 3,
  quatre: 4, four: 4,
  cinq: 5, five: 5,
  six: 6, sept: 7, seven: 7,
  huit: 8, eight: 8,
  neuf: 9, nine: 9,
  dix: 10, ten: 10,
};

function parseNumber(token: string | undefined): number | null {
  if (!token) return null;
  if (/^\d+$/.test(token)) return Number(token);
  return WORD_NUM[token] ?? null;
}

export function parseReaderVoiceCommand(text: string): ReaderVoiceCommand | null {
  const n = normalize(text);
  if (!n) return null;

  if (/^(pause|stop|arrete|arreter)$/.test(n) || /\b(pause|mets en pause)\b/.test(n)) {
    return { type: 'pause' };
  }

  if (
    /\b(reprends?|repars?|restart|recommence)\b.*\b(debut|beginning|start)\b/.test(n) ||
    /\b(depuis le debut|from the (beginning|start))\b/.test(n)
  ) {
    return { type: 'restart' };
  }

  if (
    /^(continue|reprends?|resume|play)$/.test(n) ||
    /\b(continue|reprends?|resume)\b/.test(n)
  ) {
    return { type: 'continue' };
  }

  if (/\b(coup|move)\s+(suivant|next)\b/.test(n) || /^(suivant|next)$/.test(n)) {
    return { type: 'nextMove' };
  }

  if (
    /\b(coup|move)\s+(precedent|previous)\b/.test(n) ||
    /^(precedent|previous)$/.test(n)
  ) {
    return { type: 'previousMove' };
  }

  if (
    /\b(repete|repeter|repeat)\b.*\b(toute|tout|whole|entire|all)\b.*\b(partie|game|line|ligne)\b/.test(n) ||
    /\b(repete|repeter|repeat)\b.*\b(partie|game)\b/.test(n)
  ) {
    // Active line complete (variation-aware), documented in readerPlayback.
    return { type: 'repeatAll' };
  }

  const multi = n.match(
    /\b(?:repete|repeter|repeat)\b(?:\s+(?:les|the))?\s+(\d+|un|une|one|deux|two|trois|three|quatre|four|cinq|five)\s+(?:derniers?\s+)?(?:coups?|moves?)(?:\s+(\d+|un|une|one|deux|two|trois|three|quatre|four|cinq|five)\s*(?:fois|times)?)?/,
  );
  if (multi) {
    return {
      type: 'repeatMoves',
      count: Math.max(1, parseNumber(multi[1]) ?? 1),
      repetitions: Math.max(1, parseNumber(multi[2]) ?? 1),
    };
  }

  if (
    /\b(repete|repeter|repeat)\b.*\b(dernier|last)\b.*\b(coup|move)\b/.test(n) ||
    /\b(repete|repeter|repeat)\b$/.test(n)
  ) {
    return { type: 'repeatMoves', count: 1, repetitions: 1 };
  }

  return null;
}
