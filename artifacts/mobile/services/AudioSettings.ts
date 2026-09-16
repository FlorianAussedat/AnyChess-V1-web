/**
 * Global audio settings facade over PreferencesStore.
 *
 * Voice mute (TTS) is independent from UI validation / error sound effects.
 * Speech recognition is never blocked by voice mute.
 */
import { preferencesStore } from '@/lib/preferences';

type VoiceListener = (enabled: boolean) => void;

class AudioSettings {
  private listeners = new Set<VoiceListener>();
  private unsubStore: (() => void) | null = null;

  private ensureStoreSubscription(): void {
    if (this.unsubStore) return;
    this.unsubStore = preferencesStore.onChange((prefs) => {
      this.listeners.forEach((l) => l(prefs.voiceEnabled));
    });
  }

  async ensureLoaded(): Promise<void> {
    this.ensureStoreSubscription();
    await preferencesStore.ensureLoaded();
  }

  /** Whether spoken TTS voice is enabled. */
  isVoiceEnabled(): boolean {
    return preferencesStore.getPreferences().voiceEnabled;
  }

  /**
   * @deprecated Prefer isVoiceEnabled(). Kept so existing call sites compile
   * during the Major Update migration; maps to voice mute only.
   */
  isSoundEnabled(): boolean {
    return this.isVoiceEnabled();
  }

  async setVoiceEnabled(enabled: boolean): Promise<void> {
    this.ensureStoreSubscription();
    await preferencesStore.update({ voiceEnabled: enabled });
  }

  /** @deprecated Prefer setVoiceEnabled */
  async setSoundEnabled(enabled: boolean): Promise<void> {
    await this.setVoiceEnabled(enabled);
  }

  async toggleVoice(): Promise<boolean> {
    await this.ensureLoaded();
    const next = !this.isVoiceEnabled();
    await this.setVoiceEnabled(next);
    return next;
  }

  /** @deprecated Prefer toggleVoice */
  async toggleSound(): Promise<boolean> {
    return this.toggleVoice();
  }

  onChange(listener: VoiceListener): () => void {
    this.ensureStoreSubscription();
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const audioSettings = new AudioSettings();
