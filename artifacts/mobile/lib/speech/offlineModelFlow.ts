/**
 * When a dictation model may be downloaded or marked ready.
 * Downloads are never silent. Mobile data needs its own confirmation.
 * "Ready" is a separate step that happens only after install and load succeed.
 */

export type NetworkKind = 'wifi' | 'cellular' | 'offline' | 'unknown';

export type DownloadConsent = 'none' | 'confirmed' | 'cellular';

export type ModelFlow =
  | { step: 'ready' }
  | { step: 'ask'; cellular: boolean }
  | { step: 'blocked'; reason: 'offline' }
  | { step: 'download' }
  | { step: 'failed'; reason: 'network' | 'space' | 'integrity' | 'incompatible' | 'cancelled' };

export function beginModelDownload(input: {
  ready: boolean;
  network: NetworkKind;
  consent: DownloadConsent;
}): ModelFlow {
  if (input.ready) return { step: 'ready' };
  if (input.network === 'offline') return { step: 'blocked', reason: 'offline' };
  const cellular = input.network === 'cellular';
  if (cellular && input.consent !== 'cellular') return { step: 'ask', cellular: true };
  if (!cellular && input.consent === 'none') return { step: 'ask', cellular: false };
  return { step: 'download' };
}

/**
 * Consent attached to the Download press.
 * A cellular warning already on screen is the extra confirmation.
 * Otherwise a cellular network makes the flow ask again before any bytes move.
 */
export function consentForDownloadPress(cellularWarningVisible: boolean): DownloadConsent {
  return cellularWarningVisible ? 'cellular' : 'confirmed';
}

/** A model is ready only after the archive was verified and the engine loaded it. */
export function modelIsReady(input: {
  verified: boolean;
  loaded: boolean;
}): boolean {
  return input.verified && input.loaded;
}
