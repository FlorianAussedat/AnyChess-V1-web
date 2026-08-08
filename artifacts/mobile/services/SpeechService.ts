import * as Speech from 'expo-speech';
import { audioSettings } from './AudioSettings';
import { preferencesStore } from '@/lib/preferences';
import { speechLocaleForLanguage } from '@/lib/i18n';

/**
 * Centralised text-to-speech service.
 *
 * Responsibilities:
 *  - Queue utterances so they play strictly one after another
 *  - Expose a single `isSpeaking` signal for the mic layer
 *  - Honour voice-mute (TTS only) via AudioSettings — SFX are independent
 *  - Cancel obsolete multi-step sequences when the user acts or navigates away
 *
 * Rule: live user action always has priority over queued speech.
 */

export interface SpeakOptions {
  /** Clear the queue and stop current speech before speaking this text. */
  flush?: boolean;
  /** Language override (defaults to French). */
  language?: string;
  /** Rate override. */
  rate?: number;
  /**
   * Optional owner id. When a newer cancel() targets another owner or a global
   * cancel runs, stale callbacks for this utterance are ignored.
   */
  ownerId?: string;
}

type SpeakingListener = (speaking: boolean) => void;
type CancelListener = () => void;

const DEFAULT_LANGUAGE = 'fr-FR';
const DEFAULT_RATE = 0.95;

class SpeechService {
  private queue: Array<{ text: string; ownerId?: string }> = [];
  private speaking = false;
  private listeners = new Set<SpeakingListener>();
  private cancelListeners = new Set<CancelListener>();

  /**
   * Generation token. Bumped on every stop()/flush/cancel so that stale
   * onDone / onError callbacks from a cancelled utterance are ignored and
   * cannot advance a queue that has since been replaced.
   */
  private token = 0;

  private currentLanguage = DEFAULT_LANGUAGE;
  private currentRate = DEFAULT_RATE;
  private activeOwnerId: string | undefined;

  /** Subscribe to speaking-state changes. Returns an unsubscribe function. */
  onSpeakingChange(listener: SpeakingListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify when any speech sequence is hard-cancelled (navigation, user move,
   * new exercise, etc.). Useful for clearing dictation timers outside TTS.
   */
  onCancel(listener: CancelListener): () => void {
    this.cancelListeners.add(listener);
    return () => {
      this.cancelListeners.delete(listener);
    };
  }

  get isSpeaking(): boolean {
    return this.speaking;
  }

  get generation(): number {
    return this.token;
  }

  private setSpeaking(value: boolean): void {
    if (value === this.speaking) return;
    this.speaking = value;
    this.listeners.forEach((l) => l(value));
  }

  /**
   * Enqueue text to be spoken. Utterances play sequentially. Pass
   * `{ flush: true }` to interrupt whatever is playing and speak now.
   * When voice mute is on, this is a silent no-op (SFX unaffected).
   */
  speak(text: string, options: SpeakOptions = {}): void {
    if (!text) return;

    if (!audioSettings.isVoiceEnabled()) {
      if (options.flush) this.hardStop({ notify: true });
      return;
    }

    if (options.flush) {
      this.hardStop({ notify: true });
    }

    if (options.language) {
      this.currentLanguage = options.language;
    } else {
      this.currentLanguage = speechLocaleForLanguage(
        preferencesStore.getPreferences().language,
      );
    }
    if (options.rate != null) this.currentRate = options.rate;
    if (options.ownerId) this.activeOwnerId = options.ownerId;

    this.queue.push({ text, ownerId: options.ownerId ?? this.activeOwnerId });
    if (!this.speaking) {
      this.startLoop();
    }
  }

  /**
   * Speak a multi-step sequence with an optional delay between items.
   * Returns a generation token; callers can compare against `generation`
   * or rely on cancel() to abort.
   */
  speakSequence(
    texts: string[],
    options: SpeakOptions & { gapMs?: number } = {},
  ): number {
    const { gapMs = 0, ...speakOpts } = options;
    this.hardStop({ notify: true });
    if (!texts.length) return this.token;

    if (gapMs <= 0) {
      for (const t of texts) this.speak(t, { ...speakOpts, flush: false });
      return this.token;
    }

    // Schedule with cancellable delays tracked via token.
    const myToken = this.token;
    const ownerId = speakOpts.ownerId;
    texts.forEach((text, i) => {
      const delay = i * gapMs;
      setTimeout(() => {
        if (myToken !== this.token) return;
        this.speak(text, {
          ...speakOpts,
          ownerId,
          flush: i === 0,
        });
      }, delay);
    });
    return myToken;
  }

  /** Stop all speech and clear the queue. Notifies cancel listeners. */
  stop(): void {
    this.hardStop({ notify: true });
  }

  /**
   * Alias emphasising user-priority cancellation (navigation, move, restart).
   */
  cancel(reason?: string): void {
    void reason;
    this.hardStop({ notify: true });
  }

  private hardStop(opts: { notify: boolean }): void {
    this.token += 1;
    this.queue = [];
    this.activeOwnerId = undefined;
    try {
      Speech.stop();
    } catch {
      /* ignore */
    }
    this.setSpeaking(false);
    if (opts.notify) {
      this.cancelListeners.forEach((l) => {
        try {
          l();
        } catch {
          /* ignore */
        }
      });
    }
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
      Speech.speak(next.text, {
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
