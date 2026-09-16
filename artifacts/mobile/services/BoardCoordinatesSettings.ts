/**
 * Global preference facade: show or hide chessboard file/rank coordinates.
 *
 * Independent from board visibility (eye toggle). Hiding coordinates must
 * never hide the board itself.
 */
import { preferencesStore } from '@/lib/preferences';

type CoordinatesListener = (visible: boolean) => void;

class BoardCoordinatesSettings {
  private listeners = new Set<CoordinatesListener>();
  private unsubStore: (() => void) | null = null;

  private ensureStoreSubscription(): void {
    if (this.unsubStore) return;
    this.unsubStore = preferencesStore.onChange((prefs) => {
      this.listeners.forEach((l) => l(prefs.coordinatesEnabled));
    });
  }

  async ensureLoaded(): Promise<void> {
    this.ensureStoreSubscription();
    await preferencesStore.ensureLoaded();
  }

  isCoordinatesVisible(): boolean {
    return preferencesStore.getPreferences().coordinatesEnabled;
  }

  async setCoordinatesVisible(visible: boolean): Promise<void> {
    this.ensureStoreSubscription();
    await preferencesStore.update({ coordinatesEnabled: visible });
  }

  async toggleCoordinates(): Promise<boolean> {
    await this.ensureLoaded();
    const next = !this.isCoordinatesVisible();
    await this.setCoordinatesVisible(next);
    return next;
  }

  onChange(listener: CoordinatesListener): () => void {
    this.ensureStoreSubscription();
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const boardCoordinatesSettings = new BoardCoordinatesSettings();
