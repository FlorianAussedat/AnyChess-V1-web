/**
 * When a dictation model may be downloaded or marked ready.
 * One language at a time. Mobile data needs its own yes for that download.
 * Closing the dialog or pressing back never grants mobile data.
 * An unknown network is not treated as Wi-Fi for starting a transfer, but it
 * must not pause an already accepted download (expo-network often flickers).
 * "Ready" requires verified files and a successful native load.
 */

export type NetworkKind = 'wifi' | 'cellular' | 'offline' | 'unknown';

/** Local model presence reported by the native module. */
export type ModelLocalStatus = 'installed' | 'unpacked' | 'missing';

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
  | 'verifying'
  | 'installing'
  | 'preparing'
  | 'ready'
  | 'error';

export type DownloadReason =
  | 'network'
  | 'space'
  | 'integrity'
  | 'incompatible'
  | 'cancelled'
  | 'offline'
  | 'load'
  | 'unknown';

export type ModelFlowState = {
  phase: DownloadPhase;
  network: NetworkKind;
  /** The person agreed to obtain this model. */
  accepted: boolean;
  /** Mobile data may be used for this download only. */
  mobileAllowed: boolean;
  reason: DownloadReason;
  /** True when files are already on disk and only load/prepare is needed. */
  repairOnly: boolean;
};

export type ModelFlowEffect = 'none' | 'start' | 'prepare' | 'pause' | 'pause-resume';

export type ModelFlowEvent =
  | { type: 'offer'; network: NetworkKind; status: ModelLocalStatus }
  | { type: 'download'; network: NetworkKind }
  | { type: 'download-mobile'; network: NetworkKind }
  | { type: 'wait-wifi' }
  | { type: 'dismiss' }
  | { type: 'cancel' }
  | { type: 'retry'; network: NetworkKind }
  | { type: 'network'; network: NetworkKind }
  | { type: 'received'; ok: true }
  | { type: 'received'; ok: false; reason: DownloadReason }
  | { type: 'verifying' }
  | { type: 'installing' }
  | { type: 'preparing' }
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
    repairOnly: false,
  };
}

function freshConsent(state: ModelFlowState, network: NetworkKind): ModelFlowState {
  return {
    ...state,
    network,
    accepted: false,
    mobileAllowed: false,
    reason: 'unknown',
    repairOnly: false,
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
      if (event.status === 'installed') {
        return {
          state: { ...freshConsent(state, event.network), phase: 'hidden' },
          effect: 'none',
        };
      }
      if (event.status === 'unpacked') {
        return {
          state: {
            ...freshConsent(state, event.network),
            phase: 'ask',
            repairOnly: true,
          },
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
      if (state.repairOnly) {
        return { state: { ...next, phase: 'preparing', reason: 'unknown' }, effect: 'prepare' };
      }
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
      if (state.repairOnly) {
        return { state: { ...allowed, phase: 'preparing', reason: 'unknown' }, effect: 'prepare' };
      }
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
      if (
        state.phase === 'verifying' ||
        state.phase === 'installing' ||
        state.phase === 'preparing'
      ) {
        return { state, effect: 'none' };
      }
      return {
        state: { ...freshConsent(state, state.network), phase: 'hidden' },
        effect: state.phase === 'waiting-wifi' ? 'pause' : 'none',
      };
    }
    case 'cancel': {
      if (
        state.phase === 'verifying' ||
        state.phase === 'installing' ||
        state.phase === 'preparing'
      ) {
        return { state, effect: 'none' };
      }
      return {
        state: { ...freshConsent(state, state.network), phase: 'error', reason: 'cancelled' },
        effect: state.phase === 'downloading' || state.phase === 'waiting-wifi' ? 'pause' : 'none',
      };
    }
    case 'retry': {
      return {
        state: {
          ...freshConsent(state, event.network),
          phase: 'ask',
          repairOnly: state.repairOnly,
        },
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
        // Unknown must not pause an accepted transfer: Expo Network often
        // flickers away from WIFI for a tick without a real link change.
        if (network === 'unknown') return { state: { ...state, network }, effect: 'none' };
        if (state.mobileAllowed) {
          return { state: { ...state, network }, effect: 'pause-resume' };
        }
        return { state: { ...state, network, phase: 'cellular-ask' }, effect: 'pause' };
      }
      if (state.phase === 'waiting-wifi') {
        if (!state.accepted) return { state: { ...state, network }, effect: 'none' };
        if (canTransfer({ ...state, network }, network)) {
          return {
            state: { ...state, network, phase: state.repairOnly ? 'preparing' : 'downloading' },
            effect: state.repairOnly ? 'prepare' : 'start',
          };
        }
        return { state: { ...state, network }, effect: 'none' };
      }
      return { state: { ...state, network }, effect: 'none' };
    }
    case 'received': {
      if (state.phase !== 'downloading') return { state, effect: 'none' };
      if (event.ok) return { state: { ...state, phase: 'verifying' }, effect: 'none' };
      if (event.reason === 'cancelled') {
        return { state: { ...state, phase: 'error', reason: 'cancelled' }, effect: 'none' };
      }
      return { state: { ...state, phase: 'error', reason: event.reason }, effect: 'none' };
    }
    case 'verifying': {
      return { state: { ...state, phase: 'verifying' }, effect: 'none' };
    }
    case 'installing': {
      return { state: { ...state, phase: 'installing' }, effect: 'none' };
    }
    case 'preparing': {
      return { state: { ...state, phase: 'preparing' }, effect: 'none' };
    }
    case 'installed': {
      return {
        state: { ...freshConsent(state, state.network), phase: 'ready' },
        effect: 'none',
      };
    }
    case 'install-failed': {
      return {
        state: {
          ...state,
          phase: 'error',
          reason: event.reason,
          repairOnly: event.reason === 'load' || state.repairOnly,
        },
        effect: 'none',
      };
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
  unpacked?: boolean;
  bytes: number;
  expectedBytes: number;
  /** Unknown until the archive is hashed. A mismatch discards a full file. */
  hash?: 'match' | 'mismatch' | 'unknown';
}): 'ready' | 'prepare' | 'fresh' | 'resume' | 'install' | 'discard' {
  if (input.installed) return 'ready';
  if (input.unpacked) return 'prepare';
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

/** Compact megabyte label for UI (Mo / MB only, no raw byte count). */
export function formatMegabytesOnly(bytes: number, language: 'fr' | 'en'): string {
  const mb = (Math.max(0, bytes) / 1_000_000).toFixed(1);
  if (language === 'fr') return `${mb.replace('.', ',')} Mo`;
  return `${mb} MB`;
}
