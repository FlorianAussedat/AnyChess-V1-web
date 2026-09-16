/**
 * Local ProfileStore — persists optional user info via KeyValueStorage.
 * Works on web and native through the existing storage adapters.
 */
import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import { defaultKeyValueStorage } from '../storage/AsyncKeyValueStorage.ts';
import { StorageKeys } from '../storage/StorageKeys.ts';
import { loadStoredJson } from '../storage/safeParse.ts';
import { isValidPlayerEloRangeId } from './playerEloRanges.ts';
import {
  CHESS_YEARS_MAX,
  CHESS_YEARS_MIN,
  emptyUserProfile,
  type UserProfile,
  type UserProfilePatch,
  USER_PROFILE_DOCUMENT_VERSION,
} from './types.ts';

function nowIso(): string {
  return new Date().toISOString();
}

function clampYears(value: number | null): number | null {
  if (value == null || Number.isNaN(value)) return null;
  const n = Math.round(value);
  if (n < CHESS_YEARS_MIN) return CHESS_YEARS_MIN;
  if (n > CHESS_YEARS_MAX) return CHESS_YEARS_MAX;
  return n;
}

function normalizeUsername(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 40);
}

function validateProfile(raw: unknown): UserProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== USER_PROFILE_DOCUMENT_VERSION) return null;
  if (typeof o.id !== 'string' || !o.id) return null;
  if (o.username != null && typeof o.username !== 'string') return null;
  if (o.rapidRangeId != null && typeof o.rapidRangeId !== 'string') return null;
  if (o.blitzRangeId != null && typeof o.blitzRangeId !== 'string') return null;
  if (o.bulletRangeId != null && typeof o.bulletRangeId !== 'string') return null;
  if (o.chessYears != null && typeof o.chessYears !== 'number') return null;
  if (typeof o.updatedAt !== 'string') return null;
  if (!isValidPlayerEloRangeId(o.rapidRangeId as string | null)) return null;
  if (!isValidPlayerEloRangeId(o.blitzRangeId as string | null)) return null;
  if (!isValidPlayerEloRangeId(o.bulletRangeId as string | null)) return null;

  return {
    version: USER_PROFILE_DOCUMENT_VERSION,
    id: o.id,
    username: normalizeUsername(o.username as string | null),
    rapidRangeId: (o.rapidRangeId as string | null) ?? null,
    blitzRangeId: (o.blitzRangeId as string | null) ?? null,
    bulletRangeId: (o.bulletRangeId as string | null) ?? null,
    chessYears: clampYears((o.chessYears as number | null) ?? null),
    updatedAt: o.updatedAt,
  };
}

type ProfileListener = (profile: UserProfile) => void;

export class ProfileStore {
  private profile: UserProfile | null = null;
  private loaded = false;
  private loadPromise: Promise<UserProfile> | null = null;
  private listeners = new Set<ProfileListener>();
  private readonly storage: KeyValueStorage;

  constructor(storage: KeyValueStorage = defaultKeyValueStorage) {
    this.storage = storage;
  }

  async ensureLoaded(): Promise<UserProfile> {
    if (this.loaded && this.profile) return this.profile;
    if (!this.loadPromise) {
      this.loadPromise = (async () => {
        const result = await loadStoredJson(
          this.storage,
          StorageKeys.userProfile.key,
          emptyUserProfile(),
          validateProfile,
        );
        // Missing → keep a fresh empty profile in memory but do not persist until edit.
        this.profile =
          result.status === 'ok' ? result.value : emptyUserProfile();
        this.loaded = true;
        this.loadPromise = null;
        return this.profile;
      })();
    }
    return this.loadPromise;
  }

  getProfile(): UserProfile {
    return this.profile ?? emptyUserProfile();
  }

  private async persist(next: UserProfile): Promise<void> {
    this.profile = next;
    this.listeners.forEach((l) => l(next));
    await this.storage.setItem(StorageKeys.userProfile.key, JSON.stringify(next));
  }

  async update(patch: UserProfilePatch): Promise<UserProfile> {
    await this.ensureLoaded();
    const current = this.getProfile();
    const next: UserProfile = {
      ...current,
      username:
        patch.username !== undefined
          ? normalizeUsername(patch.username)
          : current.username,
      rapidRangeId:
        patch.rapidRangeId !== undefined
          ? isValidPlayerEloRangeId(patch.rapidRangeId)
            ? patch.rapidRangeId
            : current.rapidRangeId
          : current.rapidRangeId,
      blitzRangeId:
        patch.blitzRangeId !== undefined
          ? isValidPlayerEloRangeId(patch.blitzRangeId)
            ? patch.blitzRangeId
            : current.blitzRangeId
          : current.blitzRangeId,
      bulletRangeId:
        patch.bulletRangeId !== undefined
          ? isValidPlayerEloRangeId(patch.bulletRangeId)
            ? patch.bulletRangeId
            : current.bulletRangeId
          : current.bulletRangeId,
      chessYears:
        patch.chessYears !== undefined
          ? clampYears(patch.chessYears)
          : current.chessYears,
      updatedAt: nowIso(),
    };
    await this.persist(next);
    return next;
  }

  async resetProfileFields(): Promise<UserProfile> {
    await this.ensureLoaded();
    const current = this.getProfile();
    const next: UserProfile = {
      ...emptyUserProfile(),
      id: current.id,
      updatedAt: nowIso(),
    };
    await this.persist(next);
    return next;
  }

  onChange(listener: ProfileListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

/** App singleton — screens must not touch storage keys directly. */
export const profileStore = new ProfileStore();
