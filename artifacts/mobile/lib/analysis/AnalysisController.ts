/**
 * AnyLyseur analysis orchestrator:
 * - auto position analysis with generation ids (no stale UI)
 * - full-game main-line pipeline (non-blocking)
 * - current position always preempts batch
 * - in-memory session cache keyed by FEN+profile
 * - game node results isolated by sessionId
 * - branch analysis on demand without abandoning main-line queue
 */
import type { ChessEngine } from './engine/ChessEngine.ts';
import { AnalysisCache, makeAnalysisCacheKey } from './analysisCache.ts';
import { mapEngineAnalysisToPosition } from './mapEngineAnalysis.ts';
import { DEFAULT_ANALYSIS_PROFILE, getAnalysisProfile } from './profiles.ts';
import { terminalWhiteScoreFromFen } from './scoreWhite.ts';
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
  private pumping = false;
  private profileId: AnalysisProfileId = DEFAULT_ANALYSIS_PROFILE;
  private engineStatus: AnalysisEngineStatus = 'initializing';
  private engineError: string | null = null;
  private position: PositionAnalysis | null = null;
  /** FEN the UI currently wants analyzed (even when serving from cache). */
  private desiredFen: string | null = null;
  private analyzingFen: string | null = null;
  private gameNodes: Record<string, GameNodeAnalysis> = {};
  private gameDone = 0;
  private gameTotal = 0;
  private arrowsEnabled = true;
  private pendingGameNodes: AnalyzeNodeSpec[] = [];
  /** Isolates node results across different games that reuse local ids. */
  private sessionId: string | null = null;
  private mainLineNodeIds: string[] = [];
  private mainLineComplete = false;

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
      sessionId: this.sessionId,
      mainLineComplete: this.mainLineComplete,
      desiredFen: this.desiredFen,
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
    this.clearGameResults({ keepSession: true });
    this.emit();
  }

  private clearGameResults(options?: { keepSession?: boolean }): void {
    this.gameGen += 1;
    this.gameRunning = false;
    this.pendingGameNodes = [];
    this.gameNodes = {};
    this.gameDone = 0;
    this.gameTotal = 0;
    this.mainLineComplete = false;
    if (!options?.keepSession) {
      this.sessionId = null;
      this.mainLineNodeIds = [];
    }
  }

  getCachedPosition(fen: string): PositionAnalysis | undefined {
    const profile = getAnalysisProfile(this.profileId);
    return this.cache.get(
      makeAnalysisCacheKey(fen, profile.id, profile.depth, profile.multiPv),
    );
  }

  /**
   * Analyze the currently displayed position.
   * Always bumps generation — including cache hits — so in-flight results
   * for previous FENs can never overwrite the UI.
   */
  async analyzeCurrentPosition(fen: string): Promise<PositionAnalysis | null> {
    if (this.disposed) return null;

    const gen = ++this.positionGen;
    this.desiredFen = fen;

    const terminal = terminalWhiteScoreFromFen(fen);
    if (terminal) {
      const mapped: PositionAnalysis = {
        fen,
        depth: 0,
        lines: [],
        analyzedAt: Date.now(),
        profileId: this.profileId,
        evaluation: terminal.evaluation,
        mate: terminal.mate,
        terminalOutcome: terminal.terminalOutcome,
      };
      if (gen !== this.positionGen || this.disposed) return null;
      this.position = mapped;
      this.analyzingFen = null;
      this.emit();
      void this.engine.stop().then(() => {
        if (this.gameRunning) void this.pumpGameAnalysis();
      });
      return mapped;
    }

    if (this.engineStatus === 'unavailable' || this.engineStatus === 'error') {
      const cached = this.getCachedPosition(fen);
      if (cached && gen === this.positionGen) {
        this.position = cached;
        this.analyzingFen = null;
        this.emit();
        return cached;
      }
      // Invalidate stale displayed position when switching FEN without cache.
      if (this.position && this.position.fen !== fen && gen === this.positionGen) {
        this.position = null;
        this.emit();
      }
      return null;
    }

    const cached = this.getCachedPosition(fen);
    if (cached) {
      if (gen !== this.positionGen || this.disposed) return null;
      this.position = cached;
      this.analyzingFen = null;
      if (!this.gameRunning) this.setEngineStatus('idle');
      else this.emit();
      // Stop any in-flight search for a previous FEN.
      void this.engine.stop().then(() => {
        if (this.gameRunning && gen === this.positionGen) {
          void this.pumpGameAnalysis();
        }
      });
      return cached;
    }

    // Clear stale arrows/eval immediately while waiting for the new FEN.
    if (this.position && this.position.fen !== fen) {
      this.position = null;
    }
    this.analyzingFen = fen;
    this.setEngineStatus('analyzing');
    const resumeGame = this.gameRunning;

    try {
      await this.engine.stop();
      if (this.disposed || gen !== this.positionGen) return null;
      const profile = getAnalysisProfile(this.profileId);
      const raw = await this.engine.analyzePosition({ fen, profile });
      if (this.disposed || gen !== this.positionGen) return null;
      if (raw.cancelled) return null;
      const mapped = mapEngineAnalysisToPosition(fen, raw, profile.id);
      if (!mapped) return null;
      if (this.disposed || gen !== this.positionGen) return null;
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

  /**
   * Start / resume main-line analysis for a game session.
   * Changing sessionId clears node results from previous games.
   */
  startGameAnalysis(
    nodes: AnalyzeNodeSpec[],
    options?: { sessionId?: string; asMainLine?: boolean },
  ): void {
    if (this.disposed) return;
    const sessionId = options?.sessionId ?? this.sessionId ?? 'default';
    const asMainLine = options?.asMainLine !== false;

    if (sessionId !== this.sessionId) {
      this.clearGameResults();
      this.sessionId = sessionId;
    }

    if (asMainLine) {
      this.mainLineNodeIds = nodes.map((n) => n.nodeId);
      this.gameTotal = nodes.length;
      this.recomputeMainLineProgress();
    }

    this.gameGen += 1;
    const pending: AnalyzeNodeSpec[] = [];
    const seen = new Set<string>();
    for (const n of nodes) {
      if (seen.has(n.nodeId)) continue;
      seen.add(n.nodeId);
      const existing = this.gameNodes[n.nodeId];
      if (
        existing &&
        existing.fen === n.fen &&
        existing.profileId === this.profileId
      ) {
        continue;
      }
      pending.push(n);
    }
    // Preserve unfinished main-line work when enqueueing a branch.
    if (!asMainLine) {
      for (const n of this.pendingGameNodes) {
        if (!seen.has(n.nodeId)) {
          seen.add(n.nodeId);
          pending.push(n);
        }
      }
    }
    this.pendingGameNodes = pending;
    this.gameRunning = this.pendingGameNodes.length > 0;
    this.emit();
    void this.pumpGameAnalysis();
  }

  /** Enqueue branch nodes without resetting main-line progress / badge. */
  analyzeBranchNodes(
    nodes: AnalyzeNodeSpec[],
    sessionId?: string,
  ): void {
    this.startGameAnalysis(nodes, {
      sessionId: sessionId ?? this.sessionId ?? undefined,
      asMainLine: false,
    });
  }

  stopGameAnalysis(): void {
    this.gameGen += 1;
    this.gameRunning = false;
    this.pendingGameNodes = [];
    this.emit();
  }

  /** Pause all engine work (screen blur). Does not dispose the controller. */
  async pause(): Promise<void> {
    this.positionGen += 1;
    this.analyzingFen = null;
    this.stopGameAnalysis();
    try {
      await this.engine.stop();
    } catch {
      /* ignore */
    }
    if (this.engineStatus === 'analyzing') this.setEngineStatus('idle');
  }

  private recomputeMainLineProgress(): void {
    let done = 0;
    for (const id of this.mainLineNodeIds) {
      const node = this.gameNodes[id];
      if (node && node.profileId === this.profileId) done += 1;
    }
    this.gameDone = done;
    this.mainLineComplete =
      this.mainLineNodeIds.length > 0 &&
      done >= this.mainLineNodeIds.length;
  }

  isMainLineFullyAnalyzed(): boolean {
    return this.mainLineComplete;
  }

  private async pumpGameAnalysis(): Promise<void> {
    if (this.pumping) return;
    this.pumping = true;
    const gen = this.gameGen;
    try {
      while (
        !this.disposed &&
        gen === this.gameGen &&
        this.gameRunning &&
        this.pendingGameNodes.length > 0
      ) {
        // Position analysis has priority — pause batch until free.
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
          const terminal = terminalWhiteScoreFromFen(next.fen);
          if (terminal) {
            mapped = {
              fen: next.fen,
              depth: 0,
              lines: [],
              analyzedAt: Date.now(),
              profileId: profile.id,
              evaluation: terminal.evaluation,
              mate: terminal.mate,
              terminalOutcome: terminal.terminalOutcome,
            };
            this.cache.set(key, mapped);
          }
        }

        if (!mapped) {
          if (this.engineStatus === 'unavailable') {
            this.pendingGameNodes.unshift(next);
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
            if (this.disposed || gen !== this.gameGen) {
              this.pendingGameNodes.unshift(next);
              return;
            }
            if (raw.cancelled) {
              this.pendingGameNodes.unshift(next);
              return;
            }
            // If a position analysis started while we were waiting, re-queue.
            if (this.analyzingFen) {
              this.pendingGameNodes.unshift(next);
              return;
            }
            const result = mapEngineAnalysisToPosition(
              next.fen,
              raw,
              profile.id,
            );
            if (!result) {
              this.pendingGameNodes.unshift(next);
              return;
            }
            mapped = result;
            this.cache.set(key, mapped);
          } catch (err) {
            if (this.disposed || gen !== this.gameGen) {
              this.pendingGameNodes.unshift(next);
              return;
            }
            this.pendingGameNodes.unshift(next);
            this.setEngineStatus(
              'error',
              err instanceof Error ? err.message : String(err),
            );
            this.gameRunning = false;
            return;
          }
        }

        if (this.disposed || gen !== this.gameGen) {
          this.pendingGameNodes.unshift(next);
          return;
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
          terminalOutcome: mapped.terminalOutcome,
        };
        this.recomputeMainLineProgress();
        this.emit();
      }

      if (gen === this.gameGen) {
        this.gameRunning = this.pendingGameNodes.length > 0;
        if (!this.gameRunning) {
          if (this.engineStatus === 'analyzing' && !this.analyzingFen) {
            this.setEngineStatus('idle');
          } else {
            this.emit();
          }
        }
      }
    } finally {
      this.pumping = false;
      if (
        !this.disposed &&
        this.gameRunning &&
        this.pendingGameNodes.length > 0 &&
        !this.analyzingFen &&
        this.gameGen === gen
      ) {
        void this.pumpGameAnalysis();
      }
    }
  }

  async reanalyze(
    fen: string,
    profileId?: AnalysisProfileId,
  ): Promise<PositionAnalysis | null> {
    if (profileId) {
      this.setProfile(profileId);
    } else {
      this.cache.clear();
      this.clearGameResults({ keepSession: true });
      this.emit();
    }
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
