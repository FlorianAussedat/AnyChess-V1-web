/**
 * Replaceable persistence layer for repertoire folders and PGN files.
 *
 * The UI and RepertoireService only talk to this interface. Today's
 * implementation uses AsyncStorage (works on web + native). A future
 * Android build can swap in a filesystem / SQLite backend without touching
 * callers.
 */
import type { RepertoireStoreSnapshot } from './types';
import { emptyRepertoireStore } from './types';

export interface RepertoireStorage {
  load(): Promise<RepertoireStoreSnapshot>;
  save(snapshot: RepertoireStoreSnapshot): Promise<void>;
  clear(): Promise<void>;
}

export { emptyRepertoireStore };
