/**
 * Android-only bridge to the Vosk native module.
 * Web and tests that do not load this file keep the browser recognizer.
 */
import { requireOptionalNativeModule } from 'expo';
import { VOSK_ASR_MODULE_NAME } from '../../modules/vosk-asr/index.ts';
import type { ModelLocalStatus } from './offlineModelFlow.ts';

export type VoskAlternativeEvent = {
  text: string;
  score: number;
};

export type VoskResultEvent = {
  session: number;
  alternatives: VoskAlternativeEvent[];
};

export type VoskDownloadEvent = {
  ok: boolean;
  transferId?: number;
  path?: string;
  reason?: string;
  message?: string;
};

export type VoskProgressEvent = {
  transferId?: number;
  received: number;
  total: number;
};

type Subscription = { remove(): void };

export type VoskAsrNative = {
  /**
   * Starts a background transfer. Newer natives accept transferId; older APKs
   * only take three arguments. Prefer `startVoskDownload`.
   */
  download(url: string, destPath: string, sha256: string, transferId?: number): Promise<void>;
  cancelDownload(): void;
  /** Stops the transfer and keeps the partial file. Absent on older dev clients. */
  pauseDownload?: () => void;
  /** Free bytes in app storage. Absent on older dev clients. */
  freeBytes?: () => number;
  /** Exact zip byte length on disk, or 0. Absent on older clients → treat as 0. */
  zipBytes?: (language: string) => number;
  install(zipPath: string, destDir: string, sha256: string, directory: string): Promise<string>;
  load(path: string): Promise<void>;
  setGrammar(json: string): void;
  hasMicPermission(): boolean;
  start(sessionId: number): Promise<void>;
  stop(): void;
  paths(language: string): { zip: string; root: string };
  /**
   * installed = READY + model files.
   * unpacked = model files without READY (repair via load only).
   * missing = needs download (or older clients that only returned missing).
   */
  status(language: string, directory: string): ModelLocalStatus | 'missing' | 'installed';
  addListener(event: 'onResult', listener: (event: VoskResultEvent) => void): Subscription;
  addListener(event: 'onError', listener: (event: { session: number; message: string }) => void): Subscription;
  addListener(event: 'onProgress', listener: (event: VoskProgressEvent) => void): Subscription;
  addListener(event: 'onDownloadDone', listener: (event: VoskDownloadEvent) => void): Subscription;
};

let voskModuleForTests: VoskAsrNative | null | undefined;

/** Test hook. Pass `null` to force “no native module”; omit/`undefined` to restore. */
export function setVoskModuleForTests(native: VoskAsrNative | null | undefined): void {
  voskModuleForTests = native;
}

export function getVoskModule(): VoskAsrNative | null {
  if (voskModuleForTests !== undefined) return voskModuleForTests;
  try {
    return requireOptionalNativeModule<VoskAsrNative>(VOSK_ASR_MODULE_NAME);
  } catch {
    return null;
  }
}

export function readModelLocalStatus(
  native: VoskAsrNative | null,
  language: string,
  directory: string,
): ModelLocalStatus {
  if (!native) return 'missing';
  const raw = native.status(language, directory);
  if (raw === 'installed' || raw === 'unpacked') return raw;
  return 'missing';
}

/** Queue a download on current or older Vosk natives. */
export async function startVoskDownload(
  native: VoskAsrNative,
  url: string,
  destPath: string,
  sha256: string,
  transferId: number,
): Promise<void> {
  try {
    await native.download(url, destPath, sha256, transferId);
  } catch {
    await native.download(url, destPath, sha256);
  }
}
