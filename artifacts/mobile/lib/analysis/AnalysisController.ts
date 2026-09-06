/**
 * AnyLyseur analysis orchestrator:
 * - auto position analysis with generation ids (no stale UI)
 * - full-game main-line pipeline (non-blocking)
 * - current position always preempts batch
 * - in-memory session cache
 * - branch analysis on demand (caller passes branch node list)
 */
import type { ChessEngine } from './engine/ChessEngine.ts';
import { AnalysisCache, makeAnalysisCacheKey } from './analysisCache.ts';
import { mapEngineAnalysisToPosition } from './mapEngineAnalysis.ts';
import { DEFAULT_ANALYSIS_PROFILE, getAnalysisProfile } from './profiles.ts';
import type {
  AnalysisEngineStatus,
  AnalysisProfileId,
  AnalysisSessionState,
  ClassificationInputs,
  GameNodeAnalysis,
  PositionAnalysis,
} from './types.ts';

export type AnalyzeNodeSpec = {
  nodeId: string;
  fen: string;
};

export type AnalysisControllerOptions = {
  engine: ChessEngine;
  onChange?: (state: AnalysisSessionState) => void;
};

export class AnalysisController {
  private readonly engine: ChessEngine;
  private readonly cache = new AnalysisCache();
  private readonly onChange?: (state: AnalysisSessionState) => void;
  private disposed = false;
  private positionGen = 0;
  private gameGen = 0;
  private gameRunning = false;
  private profileId: AnalysisProfileId = DEFAULT_ANALYSIS_PROFILE;
  private engineStatus: AnalysisEngineStatus = 'initializing';
  private engineError: string | null = null;
  private position: PositionAnalysis | null = null;
  private analyzingFen: string | null = null;
  private gameNodes: Record<string, GameNodeAnalysis> = {};
  private gameDone = 0;
  private gameTotal = 0;
  private arrowsEnabled = true;
  private pendingGameNodes: AnalyzeNodeSpec[] = [];

  constructor(options: AnalysisControllerOptions) {
    this.engine = options.engine;
    this.onChange = options.onChange;
  }

  getState(): AnalysisSessionState {
    return {
      engineStatus: this.engineStatus,
      engineError: this.engineError,
      profileId: this.profileId,
      position: this.position,
      positionRequestId: this.positionGen,
      analyzingFen: this.analyzingFen,
      gameNodes: { ...this.gameNodes },
      gameProgress: {
        done: this.gameDone,
        total: this.gameTotal,
        running: this.gameRunning,
      },
      arrowsEnabled: this.arrowsEnabled,
    };
  }

  private emit(): void {
    this.onChange?.(this.getState());
  }

  private setEngineStatus(
    status: AnalysisEngineStatus,
    error: string | null = null,
  ): void {
    this.engineStatus = status;
    this.engineError = error;
    this.emit();
  }

  async init(): Promise<void> {
    if (this.disposed) return;
    this.setEngineStatus('initializing');
    try {
      await this.engine.init();
      if (this.disposed) return;
      this.setEngineStatus('ready');
    } catch (err) {
      if (this.disposed) return;
      this.setEngineStatus(
        'unavailable',
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  setArrowsEnabled(enabled: boolean): void {
    this.arrowsEnabled = enabled;
    this.emit();
  }

  setProfile(profileId: AnalysisProfileId): void {
    if (this.profileId === profileId) return;
    this.profileId = profileId;
    this.cache.clear();
    this.emit();
  }

  getCachedPosition(fen: string): PositionAnalysis | undefined {
    const profile = getAnalysisProfile(this.profileId);
    return this.cache.get(
      makeAnalysisCacheKey(fen, profile.id, profile.depth, profile.multiPv),
    );
  }

  async analyzeCurrentPosition(fen: string): Promise<PositionAnalysis | null> {
    if (this.disposed) return null;

    if (this.engineStatus === 'unavailable' || this.engineStatus === 'error') {
      const cached = this.getCachedPosition(fen);
      if (cached) {
        this.position = cached;
        this.emit();
        return cached;
      }
      return null;
    }

    const cached = this.getCachedPosition(fen);
    if (cached) {
      this.position = cached;
      this.analyzingFen = null;
      if (!this.gameRunning) this.setEngineStatus('idle');
      else this.emit();
      return cached;
    }

    const gen = ++this.positionGen;
    this.analyzingFen = fen;
    this.setEngineStatus('analyzing');
    const resumeGame = this.gameRunning;

    try {
      await this.engine.stop();
      const profile = getAnalysisProfile(this.profileId);
      const raw = await this.engine.analyzePosition({ fen, profile });
      if (this.disposed || gen !== this.positionGen) return null;
      const mapped = mapEngineAnalysisToPosition(fen, raw, profile.id);
      this.cache.set(
        makeAnalysisCacheKey(fen, profile.id, profile.depth, profile.multiPv),
        mapped,
      );
      this.position = mapped;
      this.analyzingFen = null;
      this.setEngineStatus(resumeGame ? 'analyzing' : 'idle');
      if (resumeGame) void this.pumpGameAnalysis();
      return mapped;
    } catch (err) {
      if (this.disposed || gen !== this.positionGen) return null;
      this.analyzingFen = null;
      this.setEngineStatus(
        'error',
        err instanceof Error ? err.message : String(err),
      );
      return null;
    }
  }

  startGameAnalysis(nodes: AnalyzeNodeSpec[]): void {
    if (this.disposed) return;
    this.gameGen += 1;
    this.pendingGameNodes = nodes.filter((n) => !this.gameNodes[n.nodeId]);
    this.gameTotal = nodes.length;
    this.gameDone = nodes.length - this.pendingGameNodes.length;
    this.gameRunning = this.pendingGameNodes.length > 0;
    this.emit();
    void this.pumpGameAnalysis();
  }

  stopGameAnalysis(): void {
    this.gameGen += 1;
    this.gameRunning = false;
    this.pendingGameNodes = [];
    this.emit();
  }

  private async pumpGameAnalysis(): Promise<void> {
    const gen = this.gameGen;
    while (
      !this.disposed &&
      gen === this.gameGen &&
      this.gameRunning &&
      this.pendingGameNodes.length > 0
    ) {
      if (this.analyzingFen) return;

      const next = this.pendingGameNodes.shift()!;
      const profile = getAnalysisProfile(this.profileId);
      const key = makeAnalysisCacheKey(
        next.fen,
        profile.id,
        profile.depth,
        profile.multiPv,
      );
      let mapped = this.cache.get(key);
      if (!mapped) {
        if (this.engineStatus === 'unavailable') {
          this.gameRunning = false;
          this.emit();
          return;
        }
        this.setEngineStatus('analyzing');
        try {
          const raw = await this.engine.analyzePosition({
            fen: next.fen,
            profile,
          });
          if (this.disposed || gen !== this.gameGen) return;
          mapped = mapEngineAnalysisToPosition(next.fen, raw, profile.id);
          this.cache.set(key, mapped);
        } catch (err) {
          if (this.disposed || gen !== this.gameGen) return;
          this.setEngineStatus(
            'error',
            err instanceof Error ? err.message : String(err),
          );
          this.gameRunning = false;
          return;
        }
      }

      this.gameNodes[next.nodeId] = {
        nodeId: next.nodeId,
        fen: next.fen,
        evaluation: mapped.evaluation,
        mate: mapped.mate,
        bestMove: mapped.bestMove,
        depth: mapped.depth,
        analyzedAt: mapped.analyzedAt,
        profileId: mapped.profileId,
      };
      this.gameDone += 1;
      this.emit();
    }

    if (gen === this.gameGen) {
      this.gameRunning = false;
      if (this.engineStatus === 'analyzing' && !this.analyzingFen) {
        this.setEngineStatus('idle');
      } else {
        this.emit();
      }
    }
  }

  async reanalyze(
    fen: string,
    profileId?: AnalysisProfileId,
  ): Promise<PositionAnalysis | null> {
    if (profileId) this.setProfile(profileId);
    this.cache.clear();
    return this.analyzeCurrentPosition(fen);
  }

  getClassificationInputs(options: {
    fenBefore: string;
    fenAfter: string;
    playedMoveSan: string | null;
    playedMoveUci: string | null;
  }): ClassificationInputs {
    const before = this.getCachedPosition(options.fenBefore) ?? null;
    const after =
      this.position?.fen === options.fenAfter
        ? this.position
        : (this.getCachedPosition(options.fenAfter) ?? null);
    return {
      evalBefore: before?.evaluation ?? null,
      mateBefore: before?.mate ?? null,
      evalAfter: after?.evaluation ?? null,
      mateAfter: after?.mate ?? null,
      bestMoveUci: before?.bestMove ?? null,
      playedMoveSan: options.playedMoveSan,
      playedMoveUci: options.playedMoveUci,
    };
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    this.gameGen += 1;
    this.positionGen += 1;
    this.gameRunning = false;
    this.pendingGameNodes = [];
    try {
      await this.engine.stop();
    } catch {
      /* ignore */
    }
    this.engine.dispose();
    this.cache.clear();
  }
}
