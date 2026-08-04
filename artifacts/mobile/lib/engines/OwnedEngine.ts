/**
 * Small helper for mode screens that need a single ChessEngine instance with
 * explicit create / replace / destroy semantics (no React dependency).
 *
 * Used by mental visualisation to prevent Stockfish Worker accumulation.
 */
import type { ChessEngine } from '../engine.ts';

export type EngineFactory = () => ChessEngine;

export class OwnedEngine {
  private engine: ChessEngine | null = null;
  private readonly factory: EngineFactory;

  constructor(factory: EngineFactory) {
    this.factory = factory;
  }

  /** Return the current engine, creating one if needed. */
  ensure(): ChessEngine {
    if (!this.engine) {
      this.engine = this.factory();
    }
    return this.engine;
  }

  get current(): ChessEngine | null {
    return this.engine;
  }

  /** Destroy the current engine if any. Safe to call repeatedly. */
  destroy(): void {
    const prev = this.engine;
    this.engine = null;
    if (!prev) return;
    try {
      prev.cancel?.();
    } catch {
      /* ignore */
    }
    try {
      prev.destroy?.();
    } catch {
      /* ignore */
    }
  }
}
