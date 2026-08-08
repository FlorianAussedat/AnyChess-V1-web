/**
 * Global default TTS voice speed (1–10).
 * Exercises may keep a local session value after reading this default.
 */
import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import { defaultKeyValueStorage } from '../storage/AsyncKeyValueStorage.ts';
import { StorageKeys } from '../storage/StorageKeys.ts';
import {
  DEFAULT_VOICE_SPEED,
  VOICE_SPEED_MAX,
  VOICE_SPEED_MIN,
} from '../continueLine/voiceSpeed.ts';

type SpeedListener = (speed: number) => void;

function clampSpeed(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_VOICE_SPEED;
  return Math.max(
    VOICE_SPEED_MIN,
    Math.min(VOICE_SPEED_MAX, Math.round(value)),
  );
}

export class VoiceSpeedSettings {
  private speed = DEFAULT_VOICE_SPEED;
  private loaded = false;
  private loadPromise: Promise<void> | null = null;
  private listeners = new Set<SpeedListener>();
  private readonly storage: KeyValueStorage;

  constructor(storage: KeyValueStorage = defaultKeyValueStorage) {
    this.storage = storage;
  }

  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    if (!this.loadPromise) {
      this.loadPromise = (async () => {
        try {
          const raw = await this.storage.getItem(StorageKeys.defaultVoiceSpeed.key);
          if (raw != null && raw !== '') {
            const n = Number(raw);
            if (Number.isFinite(n)) this.speed = clampSpeed(n);
          }
        } catch {
          /* keep default */
        } finally {
          this.loaded = true;
          this.loadPromise = null;
        }
      })();
    }
    await this.loadPromise;
  }

  getDefaultSpeed(): number {
    return this.speed;
  }

  async setDefaultSpeed(speed: number): Promise<number> {
    const next = clampSpeed(speed);
    if (this.speed === next && this.loaded) return next;
    this.speed = next;
    this.listeners.forEach((l) => l(next));
    try {
      await this.storage.setItem(StorageKeys.defaultVoiceSpeed.key, String(next));
    } catch {
      /* non-critical */
    }
    return next;
  }

  async resetToDefault(): Promise<number> {
    return this.setDefaultSpeed(DEFAULT_VOICE_SPEED);
  }

  onChange(listener: SpeedListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const voiceSpeedSettings = new VoiceSpeedSettings();
