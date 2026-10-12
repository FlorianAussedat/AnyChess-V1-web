/**
 * Which newly played moves should be spoken.
 * A shrink (retry, restore) never replays history.
 * Voice off still advances the cursor, so enabling it later does not read the past.
 */
export function movesToAnnounce(
  previousCount: number,
  sans: readonly string[],
  voiceEnabled: boolean,
): { nextCount: number; toSpeak: string[] } {
  if (sans.length < previousCount) {
    return { nextCount: sans.length, toSpeak: [] };
  }
  if (!voiceEnabled) {
    return { nextCount: sans.length, toSpeak: [] };
  }
  return { nextCount: sans.length, toSpeak: sans.slice(previousCount) };
}
