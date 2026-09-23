/**
 * Minimal Android AppState helper. Node tests, web, and iOS get a no-op.
 *
 * G5: the native process is killed on background (Kotlin + UciTransport).
 * Callers stop the search on `background` and re-init on `active`.
 */
export function subscribeAndroidAppState(
  listener: (state: string) => void,
): () => void {
  try {
    const rn = require('react-native') as {
      AppState: {
        addEventListener: (
          event: string,
          cb: (state: string) => void,
        ) => { remove: () => void };
      };
      Platform: { OS: string };
    };
    if (rn.Platform?.OS !== 'android') return () => {};
    const sub = rn.AppState.addEventListener('change', listener);
    return () => {
      try {
        sub.remove();
      } catch {
        /* ignore */
      }
    };
  } catch {
    return () => {};
  }
}
