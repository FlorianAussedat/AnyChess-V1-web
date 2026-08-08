/**
 * Global default TTS voice speed (1–10) — facade over PreferencesStore.
 * Exercises may keep a local session value after reading this default.
 */
import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import { defaultKeyValueStorage } from '../storage/AsyncKeyValueStorage.ts';
import { DEFAULT_VOICE_SPEED } from '../continueLine/voiceSpeed.ts';
import { PreferencesStore, preferencesStore } from './PreferencesStore.ts';

type SpeedListener = (speed: number) => void;

export class VoiceSpeedSettings {
  private listeners = new Set<SpeedListener>();
  private unsubStore: (() => void) | null = null;
  private readonly store: PreferencesStore;

  constructor(
    storage: KeyValueStorage = defaultKeyValueStorage,
    store?: PreferencesStore,
  ) {
    this.store = store ?? (storage === defaultKeyValueStorage
      ? preferencesStore
      : new PreferencesStore(storage));
  }

  private ensureStoreSubscription(): void {
    if (this.unsubStore) return;
    this.unsubStore = this.store.onChange((prefs) => {
      this.listeners.forEach((l) => l(prefs.voiceSpeed));
    });
  }

  async ensureLoaded(): Promise<void> {
    this.ensureStoreSubscription();
    await this.store.ensureLoaded();
  }

  getDefaultSpeed(): number {
    return this.store.getPreferences().voiceSpeed;
  }

  async setDefaultSpeed(speed: number): Promise<number> {
    this.ensureStoreSubscription();
    const next = await this.store.update({ voiceSpeed: speed });
    return next.voiceSpeed;
  }

  async resetToDefault(): Promise<number> {
    return this.setDefaultSpeed(DEFAULT_VOICE_SPEED);
  }

  onChange(listener: SpeedListener): () => void {
    this.ensureStoreSubscription();
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const voiceSpeedSettings = new VoiceSpeedSettings();
