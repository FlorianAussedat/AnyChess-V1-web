import * as Speech from 'expo-speech';
import { audioSettings } from './AudioSettings';
import { preferencesStore } from '@/lib/preferences';
import { speechLocaleForLanguage } from '@/lib/i18n';
import { DEFAULT_TTS_RATE } from '@/lib/preferences/dictationPace';

/**
 * Centralised text-to-speech service.
 *
 * Responsibilities:
 *  - Queue utterances so they play strictly one after another
 *  - Expose a single `isSpeaking` signal for the mic layer
 *  - Honour voice-mute (TTS only) via AudioSettings — SFX are independent
 *  - Cancel obsolete multi-step sequences when the user acts or navigates away
 *  - Use a fixed comfortable TTS rate (rhythm is preferences.dictationPace)
 *  - speakAndWait resolves on real utterance end (onDone / onError)
 *
 * Rule: live user action always has priority over queued speech.
 */

export interface SpeakOptions {
  /** Clear the queue and stop current speech before speaking this text. */
  flush?: boolean;
  /** Language override (defaults to app language preference). */
  language?: string;
  /**
   * Rate override for THIS utterance only.
   * When omitted, uses DEFAULT_TTS_RATE (not a second user-facing control).
   */
  rate?: number;
  /**
   * Optional owner id. When a newer cancel() targets another owner or a global
   * cancel runs, stale callbacks for this utterance are ignored.
   */
  ownerId?: string;
}

type QueueItem = {
  text: string;
  ownerId?: string;
  language: string;
  rate: number;
  /** Resolve when this utterance finishes (speakAndWait). */
  onSettled?: (result: 'done' | 'error' | 'cancelled') => void;
};

type SpeakingListener = (speaking: boolean) => void;
type CancelListener = () => void;

const FALLBACK_LANGUAGE = 'fr-FR';

class SpeechService {
  private queue: QueueItem[] = [];
  private speaking = false;
  private listeners = new Set<SpeakingListener>();
  private cancelListeners = new Set<CancelListener>();

  /**
   * Generation token. Bumped on every stop()/flush/cancel so that stale
   * onDone / onError callbacks from a cancelled utterance are ignored and
   * cannot advance a queue that has since been replaced.
   */
  private token = 0;

  private activeOwnerId: string | undefined;

  /** Settler for the utterance currently being spoken (speakAndWait). */
  private activeSettler: ((result: 'done' | 'error' | 'cancelled') => void) | null =
    null;

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

  private resolveLanguage(override?: string): string {
    if (override) return override;
    try {
      return speechLocaleForLanguage(preferencesStore.getPreferences().language);
    } catch {
      return FALLBACK_LANGUAGE;
    }
  }

  private resolveRate(override?: number): number {
    if (override != null && Number.isFinite(override)) return override;
    return DEFAULT_TTS_RATE;
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

    if (options.ownerId) this.activeOwnerId = options.ownerId;

    this.queue.push({
      text,
      ownerId: options.ownerId ?? this.activeOwnerId,
      language: this.resolveLanguage(options.language),
      rate: this.resolveRate(options.rate),
    });
    if (!this.speaking) {
      this.startLoop();
    }
  }

  /**
   * Speak text and resolve when the utterance truly finishes (onDone / onError).
   * Resolves immediately when voice is muted or text is empty.
   * Rejects with Error('cancelled') if stop/cancel runs before completion.
   */
  speakAndWait(text: string, options: SpeakOptions = {}): Promise<void> {
    if (!text) return Promise.resolve();

    if (!audioSettings.isVoiceEnabled()) {
      if (options.flush) this.hardStop({ notify: true });
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      if (options.flush) {
        this.hardStop({ notify: true });
      }

      if (options.ownerId) this.activeOwnerId = options.ownerId;

      this.queue.push({
        text,
        ownerId: options.ownerId ?? this.activeOwnerId,
        language: this.resolveLanguage(options.language),
        rate: this.resolveRate(options.rate),
        onSettled: (result) => {
          if (result === 'cancelled') {
            reject(new Error('cancelled'));
            return;
          }
          resolve();
        },
      });
      if (!this.speaking) {
        this.startLoop();
      }
    });
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
    const pending = this.queue.splice(0, this.queue.length);
    const activeSettler = this.activeSettler;
    this.activeSettler = null;
    this.activeOwnerId = undefined;
    try {
      Speech.stop();
    } catch {
      /* ignore */
    }
    this.setSpeaking(false);
    if (activeSettler) {
      try {
        activeSettler('cancelled');
      } catch {
        /* ignore */
      }
    }
    for (const item of pending) {
      try {
        item.onSettled?.('cancelled');
      } catch {
        /* ignore */
      }
    }
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

    this.activeSettler = next.onSettled ?? null;

    const settle = (result: 'done' | 'error' | 'cancelled') => {
      if (this.activeSettler === (next.onSettled ?? null)) {
        this.activeSettler = null;
      }
      try {
        next.onSettled?.(result);
      } catch {
        /* ignore */
      }
    };

    const advance = (result: 'done' | 'error') => {
      if (myToken !== this.token) {
        settle('cancelled');
        return;
      }
      settle(result);
      this.step(myToken);
    };

    try {
      Speech.speak(next.text, {
        language: next.language,
        rate: next.rate,
        onDone: () => advance('done'),
        onStopped: () => {
          /* Stops are driven by hardStop(), which settles activeSettler. */
        },
        onError: () => advance('error'),
      });
    } catch {
      advance('error');
    }
  }
}

/** Shared singleton used across all game modes. */
export const speechService = new SpeechService();
