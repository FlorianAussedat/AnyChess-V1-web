import { preferencesStore } from '../preferences/PreferencesStore.ts';
import {
  shouldDeferCloudTransfer,
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
let wifiOnlyReader: WifiOnlyReader | null = null;
let loggedMissingNetworkModule = false;

export function setCloudTransferReadersForTests(readers: {
  transport?: TransportReader | null;
  wifiOnly?: WifiOnlyReader | null;
}): void {
  if ('transport' in readers) transportReader = readers.transport ?? null;
  if ('wifiOnly' in readers) wifiOnlyReader = readers.wifiOnly ?? null;
}

async function readWifiOnly(): Promise<boolean> {
  if (wifiOnlyReader) return wifiOnlyReader();
  try {
    await preferencesStore.ensureLoaded();
    return preferencesStore.getPreferences().syncOnWifiOnly !== false;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[AnyChess] Wi-Fi-only preference unread: ${message}`);
    return true;
  }
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
          '[AnyChess] ExpoNetwork is not in this client. Wi-Fi versus mobile data cannot be told apart until the Android dev client is rebuilt with expo-network.',
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
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[AnyChess] network type unavailable: ${message}`);
    return 'unknown';
  }
}

export async function decideCloudTransfer(allowCellular = false): Promise<CloudTransferDecision> {
  const [wifiOnly, transport] = await Promise.all([readWifiOnly(), readSyncTransport()]);
  return {
    wifiOnly,
    transport,
    offline: transport === 'offline',
    defer: shouldDeferCloudTransfer({ wifiOnly, transport, allowCellular }),
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
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[AnyChess] network watch failed: ${message}`);
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
