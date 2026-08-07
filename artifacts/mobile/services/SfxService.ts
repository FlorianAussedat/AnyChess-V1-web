/**
 * UI validation / error sound effects — independent from TTS voice mute.
 */
import { Audio } from 'expo-av';
import type { AVPlaybackSource } from 'expo-av';

class SfxService {
  private success: Audio.Sound | null = null;
  private error: Audio.Sound | null = null;
  private loading: Promise<void> | null = null;

  private async ensureLoaded(): Promise<void> {
    if (this.success && this.error) return;
    if (!this.loading) {
      this.loading = (async () => {
        try {
          const successSrc = require('@/assets/sounds/success.wav') as AVPlaybackSource;
          const errorSrc = require('@/assets/sounds/error.wav') as AVPlaybackSource;
          const [s, e] = await Promise.all([
            Audio.Sound.createAsync(successSrc, { shouldPlay: false, volume: 0.45 }),
            Audio.Sound.createAsync(errorSrc, { shouldPlay: false, volume: 0.4 }),
          ]);
          this.success = s.sound;
          this.error = e.sound;
        } catch {
          /* SFX optional */
        } finally {
          this.loading = null;
        }
      })();
    }
    await this.loading;
  }

  async playSuccess(): Promise<void> {
    await this.ensureLoaded();
    try {
      await this.success?.replayAsync();
    } catch {
      /* ignore */
    }
  }

  async playError(): Promise<void> {
    await this.ensureLoaded();
    try {
      await this.error?.replayAsync();
    } catch {
      /* ignore */
    }
  }
}

export const sfxService = new SfxService();
