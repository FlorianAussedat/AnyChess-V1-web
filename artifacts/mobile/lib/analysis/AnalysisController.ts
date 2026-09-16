/**
 * AnyLyseur analysis orchestrator:
 * - auto position analysis with generation ids (no stale UI)
 * - full-game pipeline: current → main line → variants
 * - current position always preempts batch
 * - session-global in-memory cache (survives leave/reopen)
 * - game node results isolated by sessionId + fingerprint
 */
import type { ChessEngine } from './engine/ChessEngine.ts';
import { mapEngineAnalysisToPosition } from './mapEngineAnalysis.ts';
import { DEFAULT_ANALYSIS_PROFILE, getAnalysisProfile } from './profiles.ts';
import { terminalWhiteScoreFromFen } from './scoreWhite.ts';
import { sessionAnalysisStore } from './sessionAnalysisStore.ts';
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

export type AnalysisPhase = 'idle' | 'main' | 'variants' | 'complete';

function analysisDevLog(message: string): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // eslint-disable-next-line no-console
    console.log(message);
  }
}

export class AnalysisController {
  private readonly engine: ChessEngine;
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
  private desiredFen: string | null = null;
  private analyzingFen: string | null = null;
  private gameNodes: Record<string, GameNodeAnalysis> = {};
  private gameDone = 0;
  private gameTotal = 0;
  private arrowsEnabled = true;
  private pendingGameNodes: AnalyzeNodeSpec[] = [];
  private sessionId: string | null = null;
  private fingerprint: string | null = null;
  private mainLineNodeIds: string[] = [];
  private variantNodeIds: string[] = [];
  private mainLineComplete = false;
  private variantsComplete = false;
  private gameComplete = false;
  private phase: AnalysisPhase = 'idle';
  private pendingPumpAfterReady = false;

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
        phase: this.phase,
      },
      arrowsEnabled: this.arrowsEnabled,
      sessionId: this.sessionId,
      mainLineComplete: this.mainLineComplete,
      gameComplete: this.gameComplete,
      analysisPhase: this.phase,
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
      if (this.pendingPumpAfterReady || this.pendingGameNodes.length > 0) {
        this.pendingPumpAfterReady = false;
        this.gameRunning = this.pendingGameNodes.length > 0;
        void this.pumpGameAnalysis();
      }
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
    sessionAnalysisStore.clearPositionsForProfile(profileId);
    this.clearGameResultsLocal({ keepSession: true });
    this.emit();
  }

  private clearGameResultsLocal(options?: { keepSession?: boolean }): void {
    this.gameGen += 1;
    this.gameRunning = false;
    this.pendingGameNodes = [];
    this.gameNodes = {};
    this.gameDone = 0;
    this.gameTotal = 0;
    this.mainLineComplete = false;
    this.variantsComplete = false;
    this.gameComplete = false;
    this.phase = 'idle';
    if (!options?.keepSession) {
      this.sessionId = null;
      this.fingerprint = null;
      this.mainLineNodeIds = [];
      this.variantNodeIds = [];
    }
  }

  getCachedPosition(fen: string): PositionAnalysis | undefined {
    const profile = getAnalysisProfile(this.profileId);
    return sessionAnalysisStore.getPosition(
      fen,
      profile.id,
      profile.depth,
      profile.multiPv,
    );
  }

  private putCachedPosition(fen: string, mapped: PositionAnalysis): void {
    const profile = getAnalysisProfile(this.profileId);
    sessionAnalysisStore.setPosition(
      fen,
      profile.id,
      profile.depth,
      profile.multiPv,
      mapped,
    );
  }

  private syncGameRecord(): void {
    if (!this.sessionId || !this.fingerprint) return;
    sessionAnalysisStore.upsertGame({
      gameId: this.sessionId,
      fingerprint: this.fingerprint,
      profileId: this.profileId,
      gameNodes: { ...this.gameNodes },
      mainLineNodeIds: [...this.mainLineNodeIds],
      variantNodeIds: [...this.variantNodeIds],
      mainLineComplete: this.mainLineComplete,
      variantsComplete: this.variantsComplete,
      complete: this.gameComplete,
      updatedAt: Date.now(),
    });
  }

  private recomputeProgress(): void {
    const mainDone = this.mainLineNodeIds.filter(
      (id) => this.gameNodes[id]?.profileId === this.profileId,
    ).length;
    const varDone = this.variantNodeIds.filter(
      (id) => this.gameNodes[id]?.profileId === this.profileId,
    ).length;
    this.mainLineComplete =
      this.mainLineNodeIds.length > 0 &&
      mainDone >= this.mainLineNodeIds.length;
    this.variantsComplete =
      this.variantNodeIds.length === 0 ||
      varDone >= this.variantNodeIds.length;
    this.gameComplete = this.mainLineComplete && this.variantsComplete;

    if (!this.mainLineComplete) {
      this.phase = this.gameRunning || mainDone > 0 ? 'main' : 'idle';
      this.gameDone = mainDone;
      this.gameTotal = Math.max(1, this.mainLineNodeIds.length);
    } else if (!this.variantsComplete) {
      this.phase = 'variants';
      this.gameDone = varDone;
      this.gameTotal = Math.max(1, this.variantNodeIds.length);
    } else {
      this.phase = 'complete';
      this.gameDone =
        this.mainLineNodeIds.length + this.variantNodeIds.length;
      this.gameTotal = Math.max(1, this.gameDone);
    }
  }

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
      this.putCachedPosition(fen, mapped);
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
        sessionAnalysisStore.logCacheLookup(fen, true);
        this.position = cached;
        this.analyzingFen = null;
        this.emit();
        return cached;
      }
      if (this.position && this.position.fen !== fen && gen === this.positionGen) {
        this.position = null;
        this.emit();
      }
      return null;
    }

    const cached = this.getCachedPosition(fen);
    if (cached) {
      sessionAnalysisStore.logCacheLookup(fen, true);
      if (gen !== this.positionGen || this.disposed) return null;
      this.position = cached;
      this.analyzingFen = null;
      if (!this.gameRunning) this.setEngineStatus('idle');
      else this.emit();
      void this.engine.stop().then(() => {
        if (this.gameRunning && gen === this.positionGen) {
          void this.pumpGameAnalysis();
        }
      });
      return cached;
    }

    sessionAnalysisStore.logCacheLookup(fen, false);

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
      this.putCachedPosition(fen, mapped);
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

  startGameAnalysis(
    nodes: AnalyzeNodeSpec[],
    options?: {
      sessionId?: string;
      fingerprint?: string;
      asMainLine?: boolean;
      progressNodeIds?: string[];
      mainLineNodeIds?: string[];
      variantNodeIds?: string[];
    },
  ): void {
    if (this.disposed) return;
    const sessionId = options?.sessionId ?? this.sessionId ?? 'default';
    const fingerprint = options?.fingerprint ?? this.fingerprint ?? sessionId;
    const asMainLine = options?.asMainLine !== false;

    if (sessionId !== this.sessionId || fingerprint !== this.fingerprint) {
      this.sessionId = sessionId;
      this.fingerprint = fingerprint;
      const stored = sessionAnalysisStore.getGame(
        sessionId,
        fingerprint,
        this.profileId,
      );
      if (stored) {
        this.gameNodes = { ...stored.gameNodes };
        this.mainLineNodeIds = [...stored.mainLineNodeIds];
        this.variantNodeIds = [...stored.variantNodeIds];
        this.mainLineComplete = stored.mainLineComplete;
        this.variantsComplete = stored.variantsComplete;
        this.gameComplete = stored.complete;
        this.recomputeProgress();
        analysisDevLog(`Analysis cache HIT: game ${sessionId}`);
      } else {
        this.gameNodes = {};
        this.mainLineComplete = false;
        this.variantsComplete = false;
        this.gameComplete = false;
        this.mainLineNodeIds = [];
        this.variantNodeIds = [];
        analysisDevLog(`Analysis cache MISS: game ${sessionId}`);
      }
    }

    if (asMainLine) {
      if (options?.mainLineNodeIds) {
        this.mainLineNodeIds = options.mainLineNodeIds;
      } else if (options?.progressNodeIds) {
        this.mainLineNodeIds = options.progressNodeIds;
      } else {
        this.mainLineNodeIds = nodes.map((n) => n.nodeId);
      }
      if (options?.variantNodeIds) {
        this.variantNodeIds = options.variantNodeIds;
      }
      this.recomputeProgress();
    }

    if (this.gameComplete) {
      this.pendingGameNodes = [];
      this.gameRunning = false;
      this.phase = 'complete';
      this.emit();
      return;
    }

    // Same game already pumping — don't bump generation (would cancel work).
    if (
      this.gameRunning &&
      this.sessionId === sessionId &&
      this.fingerprint === fingerprint &&
      asMainLine
    ) {
      this.emit();
      return;
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
      const profile = getAnalysisProfile(this.profileId);
      const cached = sessionAnalysisStore.getPosition(
        n.fen,
        profile.id,
        profile.depth,
        profile.multiPv,
      );
      if (cached && cached.profileId === this.profileId) {
        this.gameNodes[n.nodeId] = {
          nodeId: n.nodeId,
          fen: n.fen,
          evaluation: cached.evaluation,
          mate: cached.mate,
          bestMove: cached.bestMove,
          depth: cached.depth,
          analyzedAt: cached.analyzedAt,
          profileId: cached.profileId,
          terminalOutcome: cached.terminalOutcome,
        };
        continue;
      }
      pending.push(n);
    }
    if (!asMainLine) {
      for (const n of this.pendingGameNodes) {
        if (!seen.has(n.nodeId)) {
          seen.add(n.nodeId);
          pending.push(n);
        }
      }
    }
    this.pendingGameNodes = pending;
    this.recomputeProgress();
    this.syncGameRecord();
    this.gameRunning = this.pendingGameNodes.length > 0;
    this.emit();

    if (this.engineStatus === 'initializing') {
      this.pendingPumpAfterReady = true;
      return;
    }
    void this.pumpGameAnalysis();
  }

  analyzeBranchNodes(nodes: AnalyzeNodeSpec[], sessionId?: string): void {
    this.startGameAnalysis(nodes, {
      sessionId: sessionId ?? this.sessionId ?? undefined,
      fingerprint: this.fingerprint ?? undefined,
      asMainLine: false,
    });
  }

  stopGameAnalysis(): void {
    this.gameGen += 1;
    this.gameRunning = false;
    this.pendingGameNodes = [];
    this.emit();
  }

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

  isMainLineFullyAnalyzed(): boolean {
    return this.mainLineComplete;
  }

  isGameFullyAnalyzed(): boolean {
    return this.gameComplete;
  }

  private async pumpGameAnalysis(): Promise<void> {
    if (this.pumping) return;
    if (this.engineStatus === 'initializing') {
      this.pendingPumpAfterReady = true;
      return;
    }
    this.pumping = true;
    const gen = this.gameGen;
    try {
      while (
        !this.disposed &&
        gen === this.gameGen &&
        this.gameRunning &&
        this.pendingGameNodes.length > 0
      ) {
        if (this.analyzingFen) return;

        const next = this.pendingGameNodes.shift()!;
        const profile = getAnalysisProfile(this.profileId);
        let mapped = sessionAnalysisStore.getPosition(
          next.fen,
          profile.id,
          profile.depth,
          profile.multiPv,
        );

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
            this.putCachedPosition(next.fen, mapped);
          }
        }

        if (!mapped) {
          if (
            this.engineStatus === 'unavailable' ||
            this.engineStatus === 'error'
          ) {
            this.pendingGameNodes.unshift(next);
            this.gameRunning = false;
            this.emit();
            return;
          }
          sessionAnalysisStore.logCacheLookup(next.fen, false);
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
            this.putCachedPosition(next.fen, mapped);
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
        } else {
          sessionAnalysisStore.logCacheLookup(next.fen, true);
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
        if (this.sessionId && this.fingerprint) {
          sessionAnalysisStore.setGameNode(
            this.sessionId,
            this.fingerprint,
            this.profileId,
            this.gameNodes[next.nodeId]!,
            {
              mainLineNodeIds: this.mainLineNodeIds,
              variantNodeIds: this.variantNodeIds,
            },
          );
        }
        const wasMainComplete = this.mainLineComplete;
        this.recomputeProgress();
        if (this.mainLineComplete && !wasMainComplete) {
          analysisDevLog('Main line complete');
          if (this.variantNodeIds.length > 0 && !this.variantsComplete) {
            analysisDevLog('Variants analysis start');
          }
        }
        if (this.gameComplete) {
          analysisDevLog('Game analysis complete');
        }
        this.emit();
      }

      if (gen === this.gameGen) {
        this.gameRunning = this.pendingGameNodes.length > 0;
        if (!this.gameRunning) {
          this.recomputeProgress();
          this.syncGameRecord();
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
      sessionAnalysisStore.clearPositionsForProfile(this.profileId);
      this.clearGameResultsLocal({ keepSession: true });
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

  /** Dispose Worker — keeps session analysis cache intact. */
  async dispose(): Promise<void> {
    this.disposed = true;
    this.gameGen += 1;
    this.positionGen += 1;
    this.gameRunning = false;
    this.pendingGameNodes = [];
    this.syncGameRecord();
    try {
      await this.engine.stop();
    } catch {
      /* ignore */
    }
    this.engine.dispose();
  }
}
