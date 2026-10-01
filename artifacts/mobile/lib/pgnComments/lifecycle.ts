import { logPgnTranslate } from './classifyMyMemory.ts';
import { setPgnTranslationHold } from './liveProvider.ts';
import { pgnTranslationQueue } from './PgnTranslationQueue.ts';

let bound = false;
let unbind: (() => void) | null = null;

export function resumePgnTranslationIfAllowed(): void {
  const policy = pgnTranslationQueue.getPolicy();
  if (!policy.catchup && !policy.import) return;
  if (pgnTranslationQueue.getLastError() === 'quota') {
    logPgnTranslate('lifecycle.skip', { reason: 'quota' });
    return;
  }
  void pgnTranslationQueue.processUntilIdle();
}

export function onPgnTranslationAppState(state: string): void {
  const active = state === 'active';
  setPgnTranslationHold(!active);
  pgnTranslationQueue.setAppForeground(active);
  if (active) resumePgnTranslationIfAllowed();
}

export function bindPgnTranslationLifecycle(): () => void {
  if (bound) return unbind ?? (() => {});
  bound = true;
  setPgnTranslationHold(false);
  pgnTranslationQueue.setAppForeground(true);
  try {
    const rn = require('react-native') as {
      AppState: {
        addEventListener: (
          event: string,
          cb: (state: string) => void,
        ) => { remove: () => void };
      };
    };
    const sub = rn.AppState.addEventListener('change', onPgnTranslationAppState);
    unbind = () => {
      bound = false;
      try {
        sub.remove();
      } catch {
        /* ignore */
      }
      unbind = null;
    };
    logPgnTranslate('lifecycle.bind', { ok: true });
    return unbind;
  } catch {
    bound = false;
    unbind = null;
    return () => {};
  }
}
