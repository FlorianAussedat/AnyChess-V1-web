/**
 * Global audio output settings (sound on/off).
 *
 * Independent from board visibility and microphone input. When sound is
 * disabled, TTS and SFX must be silent, but speech recognition may continue.
 * Persisted via AsyncStorage so the preference survives restarts.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'anychess.audio.soundEnabled.v1';

type SoundListener = (enabled: boolean) => void;

class AudioSettings {
  private soundEnabled = true;
  private loaded = false;
  private loadPromise: Promise<void> | null = null;
  private listeners = new Set<SoundListener>();

  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    if (!this.loadPromise) {
      this.loadPromise = (async () => {
        try {
          const raw = await AsyncStorage.getItem(STORAGE_KEY);
          if (raw === '0' || raw === 'false') this.soundEnabled = false;
          else if (raw === '1' || raw === 'true') this.soundEnabled = true;
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

  isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  async setSoundEnabled(enabled: boolean): Promise<void> {
    if (this.soundEnabled === enabled && this.loaded) return;
    this.soundEnabled = enabled;
    this.listeners.forEach((l) => l(enabled));
    try {
      await AsyncStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
    } catch {
      /* non-critical */
    }
  }

  async toggleSound(): Promise<boolean> {
    await this.ensureLoaded();
    const next = !this.soundEnabled;
    await this.setSoundEnabled(next);
    return next;
  }

  onChange(listener: SoundListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const audioSettings = new AudioSettings();
