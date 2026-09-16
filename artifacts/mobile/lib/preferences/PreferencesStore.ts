/**
 * PreferencesStore — single source of truth for user preferences.
 *
 * Migrates legacy per-key prefs (voice, coordinates, voice speed) into one
 * document. Invalid fields fall back individually; AsyncStorage failures never
 * throw to callers.
 */
import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import { defaultKeyValueStorage } from '../storage/AsyncKeyValueStorage.ts';
import { StorageKeys } from '../storage/StorageKeys.ts';
import {
  DEFAULT_VOICE_SPEED,
  VOICE_SPEED_MAX,
  VOICE_SPEED_MIN,
} from '../continueLine/voiceSpeed.ts';
import {
  DEFAULT_DICTATION_PACE,
  isDictationPace,
} from './dictationPace.ts';
import {
  DEFAULT_APP_LANGUAGE,
  DEFAULT_CHESS_NOTATION,
  USER_PREFERENCES_DOCUMENT_VERSION,
  type AppLanguage,
  type ChessNotation,
  type UserPreferences,
  type UserPreferencesPatch,
} from './types.ts';
import {
  DEFAULT_BLIND_PROBLEM_DIFFICULTY,
  DEFAULT_VISUAL_PROBLEM_DIFFICULTY,
  normalizePuzzleDifficultyBandId,
} from './puzzleDifficulty.ts';
import {
  DEFAULT_STRENGTH_BAND_ID,
  getStrengthBand,
} from '../difficulty/StockfishStrengthBands.ts';

function normalizeStrengthBandId(
  value: unknown,
  fallback: string = DEFAULT_STRENGTH_BAND_ID,
): string {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  return getStrengthBand(value).id;
}

function nowIso(): string {
  return new Date().toISOString();
}

function clampSpeed(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_VOICE_SPEED;
  return Math.max(
    VOICE_SPEED_MIN,
    Math.min(VOICE_SPEED_MAX, Math.round(value)),
  );
}

function isAppLanguage(value: unknown): value is AppLanguage {
  return value === 'fr' || value === 'en';
}

function isChessNotation(value: unknown): value is ChessNotation {
  return value === 'fr' || value === 'en';
}

function parseBoolFlag(raw: string | null | undefined): boolean | null {
  if (raw === '0' || raw === 'false') return false;
  if (raw === '1' || raw === 'true') return true;
  return null;
}

function isChessInputMode(value: unknown): value is import('./types.ts').ChessInputMode {
  return value === 'classic' || value === 'keypad';
}

export function defaultUserPreferences(): UserPreferences {
  return {
    version: USER_PREFERENCES_DOCUMENT_VERSION,
    language: DEFAULT_APP_LANGUAGE,
    chessNotation: DEFAULT_CHESS_NOTATION,
    voiceEnabled: true,
    coordinatesEnabled: true,
    voiceSpeed: DEFAULT_VOICE_SPEED,
    dictationPace: DEFAULT_DICTATION_PACE,
    visualProblemDifficulty: DEFAULT_VISUAL_PROBLEM_DIFFICULTY,
    blindProblemDifficulty: DEFAULT_BLIND_PROBLEM_DIFFICULTY,
    chessInputMode: 'classic',
    stockfishStrengthBandId: DEFAULT_STRENGTH_BAND_ID,
    updatedAt: nowIso(),
  };
}

/**
 * Merge a stored JSON object field-by-field. One bad field does not discard
 * the rest. Returns null only when `raw` is not an object.
 */
export function mergePreferencesDocument(
  raw: unknown,
  base: UserPreferences = defaultUserPreferences(),
): UserPreferences | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const next: UserPreferences = { ...base };

  if (isAppLanguage(o.language)) next.language = o.language;
  if (isChessNotation(o.chessNotation)) next.chessNotation = o.chessNotation;

  if (typeof o.voiceEnabled === 'boolean') next.voiceEnabled = o.voiceEnabled;
  if (typeof o.coordinatesEnabled === 'boolean') {
    next.coordinatesEnabled = o.coordinatesEnabled;
  }
  if (typeof o.voiceSpeed === 'number') {
    next.voiceSpeed = clampSpeed(o.voiceSpeed);
  } else if (typeof o.voiceSpeed === 'string' && o.voiceSpeed.trim() !== '') {
    const n = Number(o.voiceSpeed);
    if (Number.isFinite(n)) next.voiceSpeed = clampSpeed(n);
  }

  if (isDictationPace(o.dictationPace)) {
    next.dictationPace = o.dictationPace;
  }
  if (o.visualProblemDifficulty !== undefined) {
    next.visualProblemDifficulty = normalizePuzzleDifficultyBandId(
      o.visualProblemDifficulty,
      DEFAULT_VISUAL_PROBLEM_DIFFICULTY,
    );
  }
  if (o.blindProblemDifficulty !== undefined) {
    next.blindProblemDifficulty = normalizePuzzleDifficultyBandId(
      o.blindProblemDifficulty,
      DEFAULT_BLIND_PROBLEM_DIFFICULTY,
    );
  }
  if (isChessInputMode(o.chessInputMode)) {
    next.chessInputMode = o.chessInputMode;
  }
  if (o.stockfishStrengthBandId !== undefined) {
    next.stockfishStrengthBandId = normalizeStrengthBandId(
      o.stockfishStrengthBandId,
      next.stockfishStrengthBandId,
    );
  }

  if (typeof o.updatedAt === 'string' && o.updatedAt) {
    next.updatedAt = o.updatedAt;
  }
  next.version = USER_PREFERENCES_DOCUMENT_VERSION;
  return next;
}

type PrefsListener = (prefs: UserPreferences) => void;

export class PreferencesStore {
  private prefs: UserPreferences = defaultUserPreferences();
  private loaded = false;
  private hydrated = false;
  private loadPromise: Promise<UserPreferences> | null = null;
  private listeners = new Set<PrefsListener>();
  private readonly storage: KeyValueStorage;

  constructor(storage: KeyValueStorage = defaultKeyValueStorage) {
    this.storage = storage;
  }

  isHydrated(): boolean {
    return this.hydrated;
  }

  getPreferences(): UserPreferences {
    return this.prefs;
  }

  async ensureLoaded(): Promise<UserPreferences> {
    if (this.loaded) return this.prefs;
    if (!this.loadPromise) {
      this.loadPromise = (async () => {
        try {
          const migrated = await this.loadOrMigrate();
          this.prefs = migrated;
        } catch {
          this.prefs = defaultUserPreferences();
        } finally {
          this.loaded = true;
          this.hydrated = true;
          this.loadPromise = null;
          this.listeners.forEach((l) => l(this.prefs));
        }
        return this.prefs;
      })();
    }
    return this.loadPromise;
  }

  private async loadOrMigrate(): Promise<UserPreferences> {
    const defaults = defaultUserPreferences();
    let fromDoc: UserPreferences | null = null;

    try {
      const raw = await this.storage.getItem(StorageKeys.userPreferences.key);
      if (raw != null && raw !== '') {
        try {
          const parsed = JSON.parse(raw) as unknown;
          fromDoc = mergePreferencesDocument(parsed, defaults);
        } catch {
          fromDoc = null;
        }
      }
    } catch {
      fromDoc = null;
    }

    const legacy = await this.readLegacyFragments();
    const base = fromDoc ?? defaults;
    const merged: UserPreferences = {
      ...base,
      voiceEnabled: fromDoc
        ? base.voiceEnabled
        : (legacy.voiceEnabled ?? base.voiceEnabled),
      coordinatesEnabled: fromDoc
        ? base.coordinatesEnabled
        : (legacy.coordinatesEnabled ?? base.coordinatesEnabled),
      voiceSpeed: fromDoc
        ? base.voiceSpeed
        : (legacy.voiceSpeed ?? base.voiceSpeed),
      dictationPace: fromDoc?.dictationPace ?? base.dictationPace,
      updatedAt: nowIso(),
    };

    // Persist unified document when missing, or when we migrated from legacy.
    if (!fromDoc) {
      await this.writeDocument(merged);
      await this.writeLegacyMirrors(merged);
    }

    return merged;
  }

  private async readLegacyFragments(): Promise<{
    voiceEnabled: boolean | null;
    coordinatesEnabled: boolean | null;
    voiceSpeed: number | null;
  }> {
    let voiceEnabled: boolean | null = null;
    let coordinatesEnabled: boolean | null = null;
    let voiceSpeed: number | null = null;

    try {
      const voiceRaw =
        (await this.storage.getItem(StorageKeys.voiceEnabled.key)) ??
        (await this.storage.getItem(StorageKeys.voiceEnabledLegacy.key));
      voiceEnabled = parseBoolFlag(voiceRaw);
    } catch {
      /* keep null */
    }

    try {
      const coordsRaw = await this.storage.getItem(
        StorageKeys.boardCoordinatesVisible.key,
      );
      coordinatesEnabled = parseBoolFlag(coordsRaw);
    } catch {
      /* keep null */
    }

    try {
      const speedRaw = await this.storage.getItem(
        StorageKeys.defaultVoiceSpeed.key,
      );
      if (speedRaw != null && speedRaw !== '') {
        const n = Number(speedRaw);
        if (Number.isFinite(n)) voiceSpeed = clampSpeed(n);
      }
    } catch {
      /* keep null */
    }

    return { voiceEnabled, coordinatesEnabled, voiceSpeed };
  }

  private async writeDocument(prefs: UserPreferences): Promise<void> {
    try {
      await this.storage.setItem(
        StorageKeys.userPreferences.key,
        JSON.stringify(prefs),
      );
    } catch {
      /* non-critical */
    }
  }

  /** Keep legacy keys in sync for older helpers / tests during transition. */
  private async writeLegacyMirrors(prefs: UserPreferences): Promise<void> {
    try {
      await this.storage.setItem(
        StorageKeys.voiceEnabled.key,
        prefs.voiceEnabled ? '1' : '0',
      );
      await this.storage.setItem(
        StorageKeys.boardCoordinatesVisible.key,
        prefs.coordinatesEnabled ? '1' : '0',
      );
      await this.storage.setItem(
        StorageKeys.defaultVoiceSpeed.key,
        String(prefs.voiceSpeed),
      );
    } catch {
      /* non-critical */
    }
  }

  async update(patch: UserPreferencesPatch): Promise<UserPreferences> {
    await this.ensureLoaded();
    const current = this.prefs;
    const next: UserPreferences = {
      ...current,
      language:
        patch.language !== undefined && isAppLanguage(patch.language)
          ? patch.language
          : current.language,
      chessNotation:
        patch.chessNotation !== undefined &&
        isChessNotation(patch.chessNotation)
          ? patch.chessNotation
          : current.chessNotation,
      voiceEnabled:
        patch.voiceEnabled !== undefined
          ? Boolean(patch.voiceEnabled)
          : current.voiceEnabled,
      coordinatesEnabled:
        patch.coordinatesEnabled !== undefined
          ? Boolean(patch.coordinatesEnabled)
          : current.coordinatesEnabled,
      voiceSpeed:
        patch.voiceSpeed !== undefined
          ? clampSpeed(patch.voiceSpeed)
          : current.voiceSpeed,
      dictationPace:
        patch.dictationPace !== undefined &&
        isDictationPace(patch.dictationPace)
          ? patch.dictationPace
          : current.dictationPace,
      visualProblemDifficulty:
        patch.visualProblemDifficulty !== undefined
          ? normalizePuzzleDifficultyBandId(
              patch.visualProblemDifficulty,
              current.visualProblemDifficulty,
            )
          : current.visualProblemDifficulty,
      blindProblemDifficulty:
        patch.blindProblemDifficulty !== undefined
          ? normalizePuzzleDifficultyBandId(
              patch.blindProblemDifficulty,
              current.blindProblemDifficulty,
            )
          : current.blindProblemDifficulty,
      chessInputMode:
        patch.chessInputMode !== undefined &&
        isChessInputMode(patch.chessInputMode)
          ? patch.chessInputMode
          : current.chessInputMode,
      stockfishStrengthBandId:
        patch.stockfishStrengthBandId !== undefined
          ? normalizeStrengthBandId(
              patch.stockfishStrengthBandId,
              current.stockfishStrengthBandId,
            )
          : current.stockfishStrengthBandId,
      updatedAt: nowIso(),
      version: USER_PREFERENCES_DOCUMENT_VERSION,
    };

    this.prefs = next;
    this.listeners.forEach((l) => l(next));
    await this.writeDocument(next);
    await this.writeLegacyMirrors(next);
    return next;
  }

  async resetPreferences(): Promise<UserPreferences> {
    await this.ensureLoaded();
    const next = defaultUserPreferences();
    this.prefs = next;
    this.listeners.forEach((l) => l(next));
    await this.writeDocument(next);
    await this.writeLegacyMirrors(next);
    return next;
  }

  onChange(listener: PrefsListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const preferencesStore = new PreferencesStore();
