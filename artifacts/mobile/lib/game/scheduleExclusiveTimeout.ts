/**
 * Schedule a timeout while cancelling any previous handle.
 * Used by opponent kickoff so a second schedule cannot fire twice.
 */
export function scheduleExclusiveTimeout(
  previous: ReturnType<typeof setTimeout> | null,
  delayMs: number,
  onFire: () => void,
): ReturnType<typeof setTimeout> {
  if (previous != null) {
    clearTimeout(previous);
  }
  return setTimeout(onFire, delayMs);
}
