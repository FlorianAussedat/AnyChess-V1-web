/**
 * Global audio settings.
 *
 * Voice mute (TTS) is independent from UI validation / error sound effects.
 * Speech recognition is never blocked by voice mute.
 */
import { defaultKeyValueStorage } from '@/lib/storage/AsyncKeyValueStorage.ts';
import { StorageKeys } from '@/lib/storage/StorageKeys.ts';

const VOICE_KEY = StorageKeys.voiceEnabled.key;
/** Legacy key — migrated once into voiceEnabled. */
const LEGACY_SOUND_KEY = StorageKeys.voiceEnabledLegacy.key;

type VoiceListener = (enabled: boolean) => void;

class AudioSettings {
  private voiceEnabled = true;
  private loaded = false;
  private loadPromise: Promise<void> | null = null;
  private listeners = new Set<VoiceListener>();

  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    if (!this.loadPromise) {
      this.loadPromise = (async () => {
        try {
          const raw =
            (await defaultKeyValueStorage.getItem(VOICE_KEY)) ??
            (await defaultKeyValueStorage.getItem(LEGACY_SOUND_KEY));
          if (raw === '0' || raw === 'false') this.voiceEnabled = false;
          else if (raw === '1' || raw === 'true') this.voiceEnabled = true;
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

  /** Whether spoken TTS voice is enabled. */
  isVoiceEnabled(): boolean {
    return this.voiceEnabled;
  }

  /**
   * @deprecated Prefer isVoiceEnabled(). Kept so existing call sites compile
   * during the Major Update migration; maps to voice mute only.
   */
  isSoundEnabled(): boolean {
    return this.voiceEnabled;
  }

  async setVoiceEnabled(enabled: boolean): Promise<void> {
    if (this.voiceEnabled === enabled && this.loaded) return;
    this.voiceEnabled = enabled;
    this.listeners.forEach((l) => l(enabled));
    try {
      await defaultKeyValueStorage.setItem(VOICE_KEY, enabled ? '1' : '0');
    } catch {
      /* non-critical */
    }
  }

  /** @deprecated Prefer setVoiceEnabled */
  async setSoundEnabled(enabled: boolean): Promise<void> {
    await this.setVoiceEnabled(enabled);
  }

  async toggleVoice(): Promise<boolean> {
    await this.ensureLoaded();
    const next = !this.voiceEnabled;
    await this.setVoiceEnabled(next);
    return next;
  }

  /** @deprecated Prefer toggleVoice */
  async toggleSound(): Promise<boolean> {
    return this.toggleVoice();
  }

  onChange(listener: VoiceListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const audioSettings = new AudioSettings();
