/**
 * When a dictation model may be downloaded or marked ready.
 * One language at a time. Mobile data needs its own yes for that download.
 * Closing the dialog or pressing back never grants mobile data.
 * An unknown network is not treated as Wi-Fi.
 * "Ready" is a separate step that happens only after install and load succeed.
 */

export type NetworkKind = 'wifi' | 'cellular' | 'offline' | 'unknown';

/** Wi-Fi and Ethernet are unmetered. Anything else, including unknown, is not Wi-Fi. */
export function networkKindFromState(state: {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
  type?: string | null;
} | null | undefined): NetworkKind {
  if (!state) return 'unknown';
  if (state.type === 'NONE' || state.isConnected === false || state.isInternetReachable === false) {
    return 'offline';
  }
  if (state.type === 'CELLULAR') return 'cellular';
  if (state.type === 'WIFI' || state.type === 'ETHERNET') return 'wifi';
  return 'unknown';
}

export type DownloadPhase =
  | 'hidden'
  | 'ask'
  | 'cellular-ask'
  | 'waiting-wifi'
  | 'downloading'
  | 'installing'
  | 'error';

export type DownloadReason =
  | 'network'
  | 'space'
  | 'integrity'
  | 'incompatible'
  | 'cancelled'
  | 'offline'
  | 'unknown';

export type ModelFlowState = {
  phase: DownloadPhase;
  network: NetworkKind;
  /** The person agreed to obtain this model. */
  accepted: boolean;
  /** Mobile data may be used for this download only. */
  mobileAllowed: boolean;
  reason: DownloadReason;
};

export type ModelFlowEffect = 'none' | 'start' | 'pause' | 'pause-resume';

export type ModelFlowEvent =
  | { type: 'offer'; network: NetworkKind; installed: boolean }
  | { type: 'download'; network: NetworkKind }
  | { type: 'download-mobile'; network: NetworkKind }
  | { type: 'wait-wifi' }
  | { type: 'dismiss' }
  | { type: 'cancel' }
  | { type: 'retry'; network: NetworkKind }
  | { type: 'network'; network: NetworkKind }
  | { type: 'received'; ok: true }
  | { type: 'received'; ok: false; reason: DownloadReason }
  | { type: 'installed' }
  | { type: 'install-failed'; reason: DownloadReason }
  | { type: 'no-space' };

export function initialModelFlow(network: NetworkKind = 'unknown'): ModelFlowState {
  return {
    phase: 'hidden',
    network,
    accepted: false,
    mobileAllowed: false,
    reason: 'unknown',
  };
}

function freshConsent(state: ModelFlowState, network: NetworkKind): ModelFlowState {
  return {
    ...state,
    network,
    accepted: false,
    mobileAllowed: false,
    reason: 'unknown',
  };
}

function isUnmetered(network: NetworkKind): boolean {
  return network === 'wifi';
}

function canTransfer(state: ModelFlowState, network: NetworkKind): boolean {
  if (network === 'offline') return false;
  if (isUnmetered(network)) return true;
  return state.mobileAllowed;
}

export function reduceModelFlow(
  state: ModelFlowState,
  event: ModelFlowEvent,
): { state: ModelFlowState; effect: ModelFlowEffect } {
  switch (event.type) {
    case 'offer': {
      if (event.installed) {
        return {
          state: { ...freshConsent(state, event.network), phase: 'hidden' },
          effect: 'none',
        };
      }
      return {
        state: { ...freshConsent(state, event.network), phase: 'ask' },
        effect: 'none',
      };
    }
    case 'download': {
      if (state.phase !== 'ask' && state.phase !== 'error') {
        return { state: { ...state, network: event.network }, effect: 'none' };
      }
      const next = { ...state, network: event.network, accepted: true };
      if (event.network === 'offline') {
        return { state: { ...next, phase: 'error', reason: 'offline' }, effect: 'none' };
      }
      if (!isUnmetered(event.network)) {
        return {
          state: { ...next, accepted: false, phase: 'cellular-ask' },
          effect: 'none',
        };
      }
      return { state: { ...next, phase: 'downloading', reason: 'unknown' }, effect: 'start' };
    }
    case 'download-mobile': {
      if (state.phase !== 'cellular-ask') return { state, effect: 'none' };
      const allowed = { ...state, network: event.network, accepted: true, mobileAllowed: true };
      if (event.network === 'offline') {
        return { state: { ...allowed, phase: 'waiting-wifi' }, effect: 'none' };
      }
      return { state: { ...allowed, phase: 'downloading', reason: 'unknown' }, effect: 'start' };
    }
    case 'wait-wifi': {
      const waiting = {
        ...state,
        accepted: true,
        mobileAllowed: false,
        phase: 'waiting-wifi' as const,
        reason: 'unknown' as const,
      };
      const effect: ModelFlowEffect = state.phase === 'downloading' ? 'pause' : 'none';
      return { state: waiting, effect };
    }
    case 'dismiss': {
      // Never grants mobile data. A paused download keeps waiting for Wi-Fi
      // only when the person already accepted the download itself.
      if (state.phase === 'cellular-ask' && state.accepted) {
        return {
          state: { ...state, mobileAllowed: false, phase: 'waiting-wifi' },
          effect: 'none',
        };
      }
      if (state.phase === 'downloading') {
        return {
          state: { ...freshConsent(state, state.network), phase: 'error', reason: 'cancelled' },
          effect: 'pause',
        };
      }
      return {
        state: { ...freshConsent(state, state.network), phase: 'hidden' },
        effect: state.phase === 'waiting-wifi' ? 'pause' : 'none',
      };
    }
    case 'cancel': {
      return {
        state: { ...freshConsent(state, state.network), phase: 'error', reason: 'cancelled' },
        effect: state.phase === 'downloading' || state.phase === 'waiting-wifi' ? 'pause' : 'none',
      };
    }
    case 'retry': {
      return {
        state: { ...freshConsent(state, event.network), phase: 'ask' },
        effect: 'none',
      };
    }
    case 'network': {
      const network = event.network;
      if (network === state.network) return { state, effect: 'none' };
      if (state.phase === 'downloading') {
        if (network === 'offline') {
          return { state: { ...state, network, phase: 'waiting-wifi' }, effect: 'pause' };
        }
        if (isUnmetered(network)) return { state: { ...state, network }, effect: 'none' };
        if (state.mobileAllowed) {
          return { state: { ...state, network }, effect: 'pause-resume' };
        }
        return { state: { ...state, network, phase: 'cellular-ask' }, effect: 'pause' };
      }
      if (state.phase === 'waiting-wifi') {
        if (!state.accepted) return { state: { ...state, network }, effect: 'none' };
        if (canTransfer({ ...state, network }, network)) {
          return { state: { ...state, network, phase: 'downloading' }, effect: 'start' };
        }
        return { state: { ...state, network }, effect: 'none' };
      }
      return { state: { ...state, network }, effect: 'none' };
    }
    case 'received': {
      if (state.phase !== 'downloading') return { state, effect: 'none' };
      if (event.ok) return { state: { ...state, phase: 'installing' }, effect: 'none' };
      if (event.reason === 'cancelled') {
        return { state: { ...state, phase: 'error', reason: 'cancelled' }, effect: 'none' };
      }
      return { state: { ...state, phase: 'error', reason: event.reason }, effect: 'none' };
    }
    case 'installed': {
      return {
        state: { ...freshConsent(state, state.network), phase: 'hidden' },
        effect: 'none',
      };
    }
    case 'install-failed': {
      return { state: { ...state, phase: 'error', reason: event.reason }, effect: 'none' };
    }
    case 'no-space': {
      return { state: { ...state, phase: 'error', reason: 'space' }, effect: 'none' };
    }
    default:
      return { state, effect: 'none' };
  }
}

/** A model is ready only after the archive was verified and the engine loaded it. */
export function modelIsReady(input: { verified: boolean; loaded: boolean }): boolean {
  return input.verified && input.loaded;
}

/**
 * Partial archives can continue. A file larger than the zip, or a finished
 * file that failed the hash, is discarded. An already verified model is not
 * downloaded again.
 */
export function partialFilePlan(input: {
  installed: boolean;
  bytes: number;
  expectedBytes: number;
  /** Unknown until the archive is hashed. A mismatch discards a full file. */
  hash?: 'match' | 'mismatch' | 'unknown';
}): 'ready' | 'fresh' | 'resume' | 'install' | 'discard' {
  if (input.installed) return 'ready';
  if (input.bytes <= 0) return 'fresh';
  if (input.bytes > input.expectedBytes) return 'discard';
  if (input.bytes === input.expectedBytes) {
    if (input.hash === 'match') return 'install';
    if (input.hash === 'mismatch') return 'discard';
    return 'resume';
  }
  return 'resume';
}

/** Zip and unpacked model coexist until install deletes the zip. */
export function hasRoomForModel(input: {
  freeBytes: number;
  downloadBytes: number;
  installedBytes: number;
  partialBytes?: number;
}): boolean {
  const remaining = Math.max(0, input.downloadBytes - (input.partialBytes ?? 0));
  const needed = remaining + input.installedBytes + 8_000_000;
  return input.freeBytes >= needed;
}
