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
import { languageFromDevice } from './deviceLanguage.ts';
import {
  DEFAULT_APP_LANGUAGE,
  DEFAULT_CHESS_NOTATION,
  USER_PREFERENCES_DOCUMENT_VERSION,
  type AppLanguage,
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
    dictationLanguage: DEFAULT_APP_LANGUAGE,
    voiceEnabled: true,
    coordinatesEnabled: true,
    voiceSpeed: DEFAULT_VOICE_SPEED,
    dictationPace: DEFAULT_DICTATION_PACE,
    visualProblemDifficulty: DEFAULT_VISUAL_PROBLEM_DIFFICULTY,
    blindProblemDifficulty: DEFAULT_BLIND_PROBLEM_DIFFICULTY,
    chessInputMode: 'classic',
    stockfishStrengthBandId: DEFAULT_STRENGTH_BAND_ID,
    translateExistingPgnComments: false,
    translateImportedPgnComments: false,
    syncOnWifiOnly: false,
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
  // The existing interface language is authoritative when legacy choices diverge.
  // Keep aliases in the document for older clients, with one coherent value.
  next.chessNotation = next.language;
  next.dictationLanguage = next.language;
  next.syncOnWifiOnly = false;

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
  if (typeof o.translateExistingPgnComments === 'boolean') {
    next.translateExistingPgnComments = o.translateExistingPgnComments;
  }
  if (typeof o.translateImportedPgnComments === 'boolean') {
    next.translateImportedPgnComments = o.translateImportedPgnComments;
  } else if (
    typeof o.autoTranslateImportedPgnComments === 'boolean'
  ) {
    next.translateImportedPgnComments = o.autoTranslateImportedPgnComments;
  }
  if (typeof o.updatedAt === 'string' && o.updatedAt) {
    next.updatedAt = o.updatedAt;
  }
  if (o.preferencesOrigin === 'device' || o.preferencesOrigin === 'user') {
    next.preferencesOrigin = o.preferencesOrigin;
  }
  if (Array.isArray(o.manualFields)) {
    next.manualFields = [
      ...new Set(
        o.manualFields.filter((item): item is string => typeof item === 'string' && item.length > 0),
      ),
    ];
  }
  next.version = USER_PREFERENCES_DOCUMENT_VERSION;
  return next;
}

type PrefsListener = (prefs: UserPreferences) => void;

export class PreferencesStore {
  private prefs: UserPreferences = defaultUserPreferences();
  private loaded = false;
  private loadFailed = false;
  private writes: Promise<unknown> = Promise.resolve();
  private hydrated = false;
  private loadPromise: Promise<UserPreferences> | null = null;
  private listeners = new Set<PrefsListener>();
  private readonly storage: KeyValueStorage;
  private readonly deviceLanguage: () => AppLanguage;

  constructor(
    storage: KeyValueStorage = defaultKeyValueStorage,
    options?: { deviceLanguage?: () => AppLanguage },
  ) {
    this.storage = storage;
    this.deviceLanguage = options?.deviceLanguage ?? languageFromDevice;
  }

  usesStorage(storage: KeyValueStorage): boolean {
    return storage === this.storage;
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
          this.loadFailed = false;
        } catch {
          this.loadFailed = true;
        } finally {
          this.loaded = !this.loadFailed;
          this.hydrated = true;
          this.loadPromise = null;
          this.listeners.forEach((l) => l(this.prefs));
        }
        return this.prefs;
      })();
    }
    return this.loadPromise;
  }

  /**
   * Re-read the document after cloud sync or account switch.
   * Does not invent a new document when the key is missing: a deliberate
   * clear must not be replaced by phone defaults.
   */
  async reloadFromStorage(): Promise<UserPreferences> {
    let raw: string | null = null;
    try {
      raw = await this.storage.getItem(StorageKeys.userPreferences.key);
    } catch {
      return this.prefs;
    }
    if (raw == null || raw === '') return this.prefs;
    this.loaded = false;
    this.loadPromise = null;
    return this.ensureLoaded();
  }

  private async loadOrMigrate(): Promise<UserPreferences> {
    const defaults = defaultUserPreferences();
    let fromDoc: UserPreferences | null = null;
    let storedDocument: string | null = null;

    try {
      const raw = await this.storage.getItem(StorageKeys.userPreferences.key);
      storedDocument = raw;
      if (raw != null && raw !== '') {
        try {
          const parsed = JSON.parse(raw) as unknown;
          fromDoc = mergePreferencesDocument(parsed, defaults);
        } catch {
          fromDoc = null;
        }
      }
    } catch (error) {
      throw error;
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
      updatedAt: fromDoc ? base.updatedAt : nowIso(),
    };

    // First launch only. An existing document — including a language chosen
    // before this flag existed — is left untouched.
    if (!fromDoc) {
      const created: UserPreferences = {
        ...merged,
        language: this.deviceLanguage(),
        preferencesOrigin: 'device',
        manualFields: [],
        updatedAt: nowIso(),
      };
      created.chessNotation = created.language;
      created.dictationLanguage = created.language;
      await this.writeDocument(created);
      await this.writeLegacyMirrors(created);
      return created;
    }

    // Persist the migration without inventing a newer user change timestamp.
    if (JSON.stringify(merged) !== storedDocument) await this.writeDocument(merged);
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
    await this.storage.setItem(StorageKeys.userPreferences.key, JSON.stringify(prefs));
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

  update(patch: UserPreferencesPatch): Promise<UserPreferences> {
    const work = this.writes.catch(() => {}).then(() => this.applyUpdate(patch));
    this.writes = work;
    return work;
  }

  private async applyUpdate(patch: UserPreferencesPatch): Promise<UserPreferences> {
    await this.ensureLoaded();
    if (this.loadFailed) throw new Error('preferences_read_failed');
    const current = this.prefs;
    const next: UserPreferences = {
      ...current,
      language:
        patch.language !== undefined && isAppLanguage(patch.language)
          ? patch.language
          : current.language,
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
      translateExistingPgnComments:
        patch.translateExistingPgnComments !== undefined
          ? Boolean(patch.translateExistingPgnComments)
          : current.translateExistingPgnComments,
      translateImportedPgnComments:
        patch.translateImportedPgnComments !== undefined
          ? Boolean(patch.translateImportedPgnComments)
          : current.translateImportedPgnComments,
      syncOnWifiOnly: false,
      updatedAt: nowIso(),
      version: USER_PREFERENCES_DOCUMENT_VERSION,
    };

    next.chessNotation = next.language;
    next.dictationLanguage = next.language;

    const touched = (Object.keys(patch) as (keyof UserPreferencesPatch)[]).filter(
      (key) => patch[key] !== undefined,
    );
    if (isAppLanguage(patch.language)) {
      touched.push('chessNotation', 'dictationLanguage');
    }
    if (current.preferencesOrigin === 'device') {
      next.preferencesOrigin = 'device';
      next.manualFields = [...new Set([...(current.manualFields ?? []), ...touched])];
    } else {
      next.preferencesOrigin = 'user';
      delete next.manualFields;
    }

    await this.writeDocument(next);
    this.prefs = next;
    this.listeners.forEach((l) => l(next));
    await this.writeLegacyMirrors(next);
    return next;
  }

  resetPreferences(): Promise<UserPreferences> {
    const work = this.writes.catch(() => {}).then(() => this.applyReset());
    this.writes = work;
    return work;
  }

  private async applyReset(): Promise<UserPreferences> {
    await this.ensureLoaded();
    if (this.loadFailed) throw new Error('preferences_read_failed');
    const next: UserPreferences = {
      ...defaultUserPreferences(),
      preferencesOrigin: 'user',
    };
    await this.writeDocument(next);
    this.prefs = next;
    this.listeners.forEach((l) => l(next));
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
