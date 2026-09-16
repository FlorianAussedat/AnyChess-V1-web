/**
 * Single shared StockfishAnalysisService for endgame modes (Web Worker).
 * Avoids creating/destroying a Worker on every screen navigation.
 *
 * Architecture note (play vs analysis concurrency) — Option B:
 * Classic/Openings play uses StockfishEngine (own Worker).
 * AnyLyseur analysis uses ChessEngineService (own Worker).
 * Endgames share this runtime (third Worker when those modes are used).
 * Separate Workers so a low-priority analysis search never blocks
 * opponent move selection. Within each Worker, searches are serialized.
 */
import { Platform } from 'react-native';
import { StockfishAnalysisService } from '../../defendDraw/StockfishAnalysisService.ts';
import { DEFEND_DRAW_ENGINE_CONFIG } from '../../defendDraw/engineConfig.ts';
import type { EngineStatus } from '../analysis/types.ts';
import { STOCKFISH_PLATFORM_NOTES } from '../analysis/types.ts';
import { getStockfishWorkerUrl } from '../stockfish/workerUrl.ts';

export type SharedStockfishStatus =
  | 'uninitialized'
  | 'loading'
  | 'ready'
  | 'thinking'
  | 'error'
  | 'unavailable';

export type SharedStockfishSnapshot = {
  status: SharedStockfishStatus;
  lastError: string | null;
  workerPath: string;
  platformOs: string;
  backend: string;
  bootStartedAt: number | null;
  readyAt: number | null;
};

type Listener = (snap: SharedStockfishSnapshot) => void;

let singleton: SharedStockfishRuntime | null = null;

export class SharedStockfishRuntime {
  private service: StockfishAnalysisService | null = null;
  private initPromise: Promise<StockfishAnalysisService> | null = null;
  private status: SharedStockfishStatus = 'uninitialized';
  private lastError: string | null = null;
  private bootStartedAt: number | null = null;
  private readyAt: number | null = null;
  private unsubStatus: (() => void) | null = null;
  private readonly listeners = new Set<Listener>();
  private cachedSnapshot: SharedStockfishSnapshot;
  readonly workerPath: string;
  readonly platformOs: string;

  private constructor() {
    this.platformOs = Platform.OS;
    this.workerPath = getStockfishWorkerUrl();
    if (Platform.OS !== 'web') {
      this.status = 'unavailable';
      this.lastError = STOCKFISH_PLATFORM_NOTES.expoGo.reason;
    }
    this.cachedSnapshot = this.buildSnapshot();
  }

  static get(): SharedStockfishRuntime {
    if (!singleton) singleton = new SharedStockfishRuntime();
    return singleton;
  }

  /** Test-only teardown. */
  static resetForTests(): void {
    singleton?.shutdown();
    singleton = null;
  }

  getSnapshot(): SharedStockfishSnapshot {
    return this.cachedSnapshot;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private buildSnapshot(): SharedStockfishSnapshot {
    return {
      status: this.status,
      lastError: this.lastError,
      workerPath: this.workerPath,
      platformOs: this.platformOs,
      backend:
        Platform.OS === 'web'
          ? STOCKFISH_PLATFORM_NOTES.web.backend
          : 'native-unavailable',
      bootStartedAt: this.bootStartedAt,
      readyAt: this.readyAt,
    };
  }

  private publishSnapshot(): void {
    const next = this.buildSnapshot();
    const prev = this.cachedSnapshot;
    if (
      prev.status === next.status &&
      prev.lastError === next.lastError &&
      prev.bootStartedAt === next.bootStartedAt &&
      prev.readyAt === next.readyAt
    ) {
      return;
    }
    this.cachedSnapshot = next;
    for (const l of this.listeners) l(this.cachedSnapshot);
  }

  private setStatus(next: SharedStockfishStatus): void {
    if (this.status === next) return;
    this.status = next;
    this.publishSnapshot();
  }

  prewarm(): void {
    if (Platform.OS !== 'web') return;
    void this.ensureService().catch(() => {
      /* surfaced via snapshot */
    });
  }

  getService(): StockfishAnalysisService | null {
    return this.service;
  }

  isEngineReady(): boolean {
    return this.status === 'ready' || this.status === 'thinking';
  }

  ensureService(): Promise<StockfishAnalysisService> {
    if (Platform.OS !== 'web') {
      return Promise.reject(new Error(this.lastError ?? 'Stockfish unavailable on native.'));
    }
    if (this.service && this.isEngineReady()) {
      return Promise.resolve(this.service);
    }
    if (this.initPromise) return this.initPromise;

    this.bootStartedAt = Date.now();
    this.readyAt = null;
    this.lastError = null;
    this.status = 'loading';
    this.publishSnapshot();

    this.initPromise = this.bootFresh()
      .then((svc) => {
        this.readyAt = Date.now();
        this.status = 'ready';
        this.publishSnapshot();
        return svc;
      })
      .catch((err) => {
        this.lastError = err instanceof Error ? err.message : String(err);
        console.error('[SharedStockfishRuntime] boot failed:', err);
        this.status = 'error';
        this.publishSnapshot();
        throw err;
      })
      .finally(() => {
        this.initPromise = null;
      });

    return this.initPromise;
  }

  private bootFresh(): Promise<StockfishAnalysisService> {
    this.detachService();
    const service = new StockfishAnalysisService({
      moveTimeMs: DEFEND_DRAW_ENGINE_CONFIG.moveTimeMs,
      analysisTimeoutMs: DEFEND_DRAW_ENGINE_CONFIG.analysisTimeoutMs,
      bootTimeoutMs: DEFEND_DRAW_ENGINE_CONFIG.bootTimeoutMs,
      enginePath: this.workerPath,
    });
    this.service = service;
    this.unsubStatus = service.onStatusChange((s: EngineStatus) => {
      if (s === 'thinking') this.setStatus('thinking');
      else if (s === 'ready') this.setStatus('ready');
      else if (s === 'loading') this.setStatus('loading');
      else if (s === 'error') this.setStatus('error');
      else if (s === 'unavailable') this.setStatus('unavailable');
    });
    return service.init().then(() => service);
  }

  async retry(): Promise<StockfishAnalysisService> {
    this.detachService();
    this.lastError = null;
    this.bootStartedAt = null;
    this.readyAt = null;
    this.status = 'uninitialized';
    this.publishSnapshot();
    return this.ensureService();
  }

  /** Release listeners only — keeps Worker alive for next screen. */
  release(): void {
    /* intentional no-op: shared runtime persists */
  }

  shutdown(): void {
    this.detachService();
    this.setStatus(Platform.OS === 'web' ? 'uninitialized' : 'unavailable');
  }

  private detachService(): void {
    if (this.unsubStatus) {
      this.unsubStatus();
      this.unsubStatus = null;
    }
    if (this.service) {
      try {
        void this.service.getEngine().stop();
      } catch {
        /* ignore */
      }
      try {
        this.service.destroy();
      } catch {
        /* ignore */
      }
      this.service = null;
    }
    this.initPromise = null;
  }
}

export function getSharedStockfishRuntime(): SharedStockfishRuntime {
  return SharedStockfishRuntime.get();
}
