import {
  transportFromExpoState,
  type SyncTransport,
} from './wifiSyncPolicy.ts';

export type CloudTransferDecision = {
  defer: boolean;
  offline: boolean;
  transport: SyncTransport;
  wifiOnly: boolean;
};

type TransportReader = () => Promise<SyncTransport>;
type WifiOnlyReader = () => Promise<boolean>;

let transportReader: TransportReader | null = null;
let loggedMissingNetworkModule = false;

export function setCloudTransferReadersForTests(readers: {
  transport?: TransportReader | null;
  wifiOnly?: WifiOnlyReader | null;
}): void {
  if ('transport' in readers) transportReader = readers.transport ?? null;
}

/** Reads Expo Network when that native module is in the installed client. */
export async function readSyncTransport(): Promise<SyncTransport> {
  if (transportReader) return transportReader();
  try {
    const core = require('expo-modules-core') as {
      requireOptionalNativeModule?: (name: string) => object | null;
    };
    const native = core.requireOptionalNativeModule?.('ExpoNetwork');
    if (!native) {
      if (!loggedMissingNetworkModule) {
        loggedMissingNetworkModule = true;
        console.warn(
          '[AnyChess] ExpoNetwork unavailable; transfers use their existing network error handling.',
        );
      }
      return 'unknown';
    }
    const Network = require('expo-network') as {
      getNetworkStateAsync: () => Promise<{ type?: string; isConnected?: boolean }>;
    };
    const state = await Network.getNetworkStateAsync();
    return transportFromExpoState(state);
  } catch (error) {
    console.warn('[AnyChess] network type unavailable; transfer errors remain authoritative.');
    return 'unknown';
  }
}

export async function decideCloudTransfer(_allowCellular = false): Promise<CloudTransferDecision> {
  const transport = await readSyncTransport();
  return {
    wifiOnly: false,
    transport,
    offline: transport === 'offline',
    defer: false,
  };
}

export function subscribeSyncTransport(onChange: (transport: SyncTransport) => void): () => void {
  let removed = false;
  let subscription: { remove: () => void } | null = null;
  void (async () => {
    try {
      const core = require('expo-modules-core') as {
        requireOptionalNativeModule?: (name: string) => object | null;
      };
      if (!core.requireOptionalNativeModule?.('ExpoNetwork')) return;
      const Network = require('expo-network') as {
        addNetworkStateListener: (
          listener: (state: { type?: string; isConnected?: boolean }) => void,
        ) => { remove: () => void };
      };
      if (removed) return;
      subscription = Network.addNetworkStateListener((state) => {
        onChange(transportFromExpoState(state));
      });
    } catch (error) {
      console.warn('[AnyChess] network watch unavailable.');
    }
  })();
  return () => {
    removed = true;
    try {
      subscription?.remove();
    } catch {
      /* listener already gone */
    }
  };
}
