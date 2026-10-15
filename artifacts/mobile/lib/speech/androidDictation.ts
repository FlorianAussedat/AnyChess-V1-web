/**
 * Android-only bridge to the Vosk native module.
 * Web and tests that do not load this file keep the browser recognizer.
 */
import { requireOptionalNativeModule } from 'expo';
import { VOSK_ASR_MODULE_NAME } from '../../modules/vosk-asr/index.ts';

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
  path?: string;
  reason?: string;
  message?: string;
};

export type VoskProgressEvent = {
  received: number;
  total: number;
};

type Subscription = { remove(): void };

export type VoskAsrNative = {
  download(url: string, destPath: string, sha256: string): Promise<void>;
  cancelDownload(): void;
  install(zipPath: string, destDir: string, sha256: string, directory: string): Promise<string>;
  load(path: string): Promise<void>;
  setGrammar(json: string): void;
  hasMicPermission(): boolean;
  start(sessionId: number): Promise<void>;
  stop(): void;
  paths(language: string): { zip: string; root: string };
  status(language: string, directory: string): 'installed' | 'missing';
  addListener(event: 'onResult', listener: (event: VoskResultEvent) => void): Subscription;
  addListener(event: 'onError', listener: (event: { session: number; message: string }) => void): Subscription;
  addListener(event: 'onProgress', listener: (event: VoskProgressEvent) => void): Subscription;
  addListener(event: 'onDownloadDone', listener: (event: VoskDownloadEvent) => void): Subscription;
};

export function getVoskModule(): VoskAsrNative | null {
  try {
    return requireOptionalNativeModule<VoskAsrNative>(VOSK_ASR_MODULE_NAME);
  } catch {
    return null;
  }
}
