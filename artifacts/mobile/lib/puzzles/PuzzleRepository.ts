/**
 * Offline puzzle repository — imports the curated local JSON pack.
 */
import type { LocalPuzzle, PuzzleManifest } from './types.ts';
import puzzlesJson from './data/puzzles.json';
import manifestJson from './data/manifest.json';

const puzzles = puzzlesJson as LocalPuzzle[];
const manifest = manifestJson as PuzzleManifest;

const byId = new Map<string, LocalPuzzle>(puzzles.map((p) => [p.id, p]));

export class PuzzleRepository {
  getAll(): LocalPuzzle[] {
    return puzzles;
  }

  getById(id: string): LocalPuzzle | undefined {
    return byId.get(id);
  }

  count(): number {
    return puzzles.length;
  }

  getManifest(): PuzzleManifest {
    return manifest;
  }
}

/** Shared singleton for the embedded offline pack. */
export const puzzleRepository = new PuzzleRepository();
