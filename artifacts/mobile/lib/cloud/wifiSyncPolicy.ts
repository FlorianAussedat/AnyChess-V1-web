/**
 * Wi-Fi-only sync is a transfer rule, not a general offline mode.
 * Sign-in, translation and other online features stay available.
 */
export type SyncTransport = 'wifi' | 'cellular' | 'offline' | 'unknown';

export function transportFromExpoState(state: {
  type?: string;
  isConnected?: boolean;
}): SyncTransport {
  if (state.isConnected === false || state.type === 'NONE') return 'offline';
  if (state.type === 'WIFI' || state.type === 'ETHERNET') return 'wifi';
  if (state.type === 'CELLULAR' || state.type === 'WIMAX') return 'cellular';
  return 'unknown';
}

/**
 * Defer only when the setting is on and the link is known to be mobile data.
 * Unknown (module missing, VPN, other) does not block: we cannot prove it is cellular.
 */
export function shouldDeferCloudTransfer(input: {
  wifiOnly: boolean;
  transport: SyncTransport;
  allowCellular?: boolean;
}): boolean {
  if (input.allowCellular) return false;
  if (!input.wifiOnly) return false;
  return input.transport === 'cellular';
}
