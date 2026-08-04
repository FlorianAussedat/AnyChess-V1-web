/**
 * Global preference: show or hide chessboard file/rank coordinates.
 *
 * Independent from board visibility (eye toggle). Hiding coordinates must
 * never hide the board itself.
 */
import { defaultKeyValueStorage } from '@/lib/storage/AsyncKeyValueStorage.ts';
import { StorageKeys } from '@/lib/storage/StorageKeys.ts';

const STORAGE_KEY = StorageKeys.boardCoordinatesVisible.key;

type CoordinatesListener = (visible: boolean) => void;

class BoardCoordinatesSettings {
  private coordinatesVisible = true;
  private loaded = false;
  private loadPromise: Promise<void> | null = null;
  private listeners = new Set<CoordinatesListener>();

  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    if (!this.loadPromise) {
      this.loadPromise = (async () => {
        try {
          const raw = await defaultKeyValueStorage.getItem(STORAGE_KEY);
          if (raw === '0' || raw === 'false') this.coordinatesVisible = false;
          else if (raw === '1' || raw === 'true') this.coordinatesVisible = true;
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

  isCoordinatesVisible(): boolean {
    return this.coordinatesVisible;
  }

  async setCoordinatesVisible(visible: boolean): Promise<void> {
    if (this.coordinatesVisible === visible && this.loaded) return;
    this.coordinatesVisible = visible;
    this.listeners.forEach((l) => l(visible));
    try {
      await defaultKeyValueStorage.setItem(STORAGE_KEY, visible ? '1' : '0');
    } catch {
      /* non-critical */
    }
  }

  async toggleCoordinates(): Promise<boolean> {
    await this.ensureLoaded();
    const next = !this.coordinatesVisible;
    await this.setCoordinatesVisible(next);
    return next;
  }

  onChange(listener: CoordinatesListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const boardCoordinatesSettings = new BoardCoordinatesSettings();
