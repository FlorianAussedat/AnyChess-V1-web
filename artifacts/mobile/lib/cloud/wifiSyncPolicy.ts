/** Transfer transport classification; Wi-Fi and mobile data are equally allowed. */
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

/** Legacy arguments remain accepted, but the removed Wi-Fi preference cannot defer transfers. */
export function shouldDeferCloudTransfer(_input: {
  wifiOnly: boolean;
  transport: SyncTransport;
  allowCellular?: boolean;
}): boolean {
  return false;
}
