import * as Speech from 'expo-speech';
import { audioSettings } from './AudioSettings';

/**
 * Centralised text-to-speech service.
 *
 * Responsibilities:
 *  - Queue utterances so they play strictly one after another
 *    (e.g. announce the player's move, then the engine's reply).
 *  - Expose a single `isSpeaking` signal that stays true for the whole
 *    queue, so the microphone layer can pause recognition while ANY
 *    speech is playing and resume once the queue drains.
 *  - Honour global AudioSettings: when sound is muted, speak() is a no-op
 *    (isSpeaking stays false so the mic is not interrupted).
 *  - Be platform-agnostic and reusable by every game mode.
 */

export interface SpeakOptions {
  /** Clear the queue and stop current speech before speaking this text. */
  flush?: boolean;
  /** Language override (defaults to French). */
  language?: string;
  /** Rate override. */
  rate?: number;
}

type SpeakingListener = (speaking: boolean) => void;

const DEFAULT_LANGUAGE = 'fr-FR';
const DEFAULT_RATE = 0.95;

class SpeechService {
  private queue: string[] = [];
  private speaking = false;
  private listeners = new Set<SpeakingListener>();

  /**
   * Generation token. Bumped on every stop()/flush so that stale
   * onDone / onError callbacks from a cancelled utterance are ignored and
   * cannot advance a queue that has since been replaced.
   */
  private token = 0;

  private currentLanguage = DEFAULT_LANGUAGE;
  private currentRate = DEFAULT_RATE;

  /** Subscribe to speaking-state changes. Returns an unsubscribe function. */
  onSpeakingChange(listener: SpeakingListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  get isSpeaking(): boolean {
    return this.speaking;
  }

  private setSpeaking(value: boolean): void {
    if (value === this.speaking) return;
    this.speaking = value;
    this.listeners.forEach((l) => l(value));
  }

  /**
   * Enqueue text to be spoken. Utterances play sequentially. Pass
   * `{ flush: true }` to interrupt whatever is playing and speak now.
   * When global sound is muted, this is a silent no-op.
   */
  speak(text: string, options: SpeakOptions = {}): void {
    if (!text) return;

    // Output mute — do not block the mic (isSpeaking stays false).
    if (!audioSettings.isSoundEnabled()) {
      if (options.flush) this.hardStop();
      return;
    }

    if (options.flush) {
      this.hardStop();
    }

    if (options.language) this.currentLanguage = options.language;
    if (options.rate != null) this.currentRate = options.rate;

    this.queue.push(text);
    if (!this.speaking) {
      this.startLoop();
    }
  }

  /** Stop all speech and clear the queue. */
  stop(): void {
    this.hardStop();
  }

  private hardStop(): void {
    this.token += 1;
    this.queue = [];
    try {
      Speech.stop();
    } catch {
      /* ignore */
    }
    this.setSpeaking(false);
  }

  private startLoop(): void {
    const myToken = this.token;
    this.setSpeaking(true);
    this.step(myToken);
  }

  private step(myToken: number): void {
    if (myToken !== this.token) return;

    const next = this.queue.shift();
    if (next == null) {
      this.setSpeaking(false);
      return;
    }

    const advance = () => {
      if (myToken === this.token) this.step(myToken);
    };

    try {
      Speech.speak(next, {
        language: this.currentLanguage,
        rate: this.currentRate,
        onDone: advance,
        onStopped: () => {
          /* Stops are driven by hardStop(), which bumps the token; ignore. */
        },
        onError: advance,
      });
    } catch {
      advance();
    }
  }
}

/** Shared singleton used across all game modes. */
export const speechService = new SpeechService();
