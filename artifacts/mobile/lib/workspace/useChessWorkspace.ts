/**
 * Core hook for the universal chess workspace.
 * Handles navigation, variant tree, analysis cache, and Stockfish integration.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Move } from 'chess.js';
import type { DefenseAnalyzer } from '../defendDraw/defenseTypes.ts';
import type {
  ChessWorkspacePayload,
  EngineEvaluation,
  WorkspaceMove,
} from './types.ts';

export type WorkspaceEvalState = {
  evaluation: EngineEvaluation | null;
  bestSan: string | null;
  thinking: boolean;
};

export type WorkspaceFinishState = {
  phase: 'idle' | 'playing' | 'game-over';
  fen: string;
  result: string | null;
};

type WorkspaceState = {
  currentPly: number;
  variantSans: string[];
  branchRootPly: number | null;
  branchRootFen: string | null;
};

type EvalCacheEntry = {
  evaluation: EngineEvaluation;
  bestSan: string | null;
};

export function sideFromFen(fen: string): 'white' | 'black' {
  return fen.split(' ')[1] === 'b' ? 'black' : 'white';
}

export function buildFenFromMoves(
  initialFen: string,
  mainMoves: readonly WorkspaceMove[],
  currentPly: number,
  variantSans: readonly string[],
): string {
  const chess = new Chess(initialFen);
  for (let i = 0; i < currentPly && i < mainMoves.length; i += 1) {
    chess.move(mainMoves[i]!.san);
  }
  for (const san of variantSans) {
    chess.move(san);
  }
  return chess.fen();
}

function preferEvaluation(
  current: EngineEvaluation | null,
  incoming: EngineEvaluation,
): EngineEvaluation {
  if (!current) return incoming;
  const currentDepth = current.depth ?? 0;
  const incomingDepth = incoming.depth ?? 0;
  return incomingDepth >= currentDepth ? incoming : current;
}

function toWhitePerspectiveEvaluation(
  scoreCp: number,
  mateIn: number | null,
): EngineEvaluation {
  if (typeof mateIn === 'number' && Number.isFinite(mateIn)) {
    return { type: 'mate', value: mateIn, perspective: 'white' };
  }
  return { type: 'cp', value: scoreCp, perspective: 'white' };
}

function officialResultFromChess(chess: Chess): string | null {
  if (chess.isCheckmate()) return chess.turn() === 'w' ? '0-1' : '1-0';
  if (chess.isStalemate()) return '1/2-1/2';
  if (chess.isInsufficientMaterial()) return '1/2-1/2';
  if (chess.isThreefoldRepetition()) return '1/2-1/2';
  if (chess.isDraw()) return '1/2-1/2';
  return null;
}

export function useChessWorkspace(input: {
  payload: ChessWorkspacePayload;
  engine: DefenseAnalyzer | null;
  engineReady: boolean;
  debounceMs?: number;
}) {
  const { payload, engine, engineReady, debounceMs = 160 } = input;
  const isFinishVsEngine = payload.workspaceMode === 'finish-vs-engine';
  const engineColor = payload.engineOpponent?.color ?? null;
  const mainMoves = payload.moves ?? [];

  // ──────────────────────────────────────────────────────────────────────────
  // Reader / analysis state
  // ──────────────────────────────────────────────────────────────────────────
  const [state, setState] = useState<WorkspaceState>({
    currentPly: 0,
    variantSans: [],
    branchRootPly: null,
    branchRootFen: null,
  });
  const [evalState, setEvalState] = useState<WorkspaceEvalState>({
    evaluation: null,
    bestSan: null,
    thinking: false,
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Finish-vs-engine game state (separate from reader state)
  // ──────────────────────────────────────────────────────────────────────────
  const [finishState, setFinishState] = useState<WorkspaceFinishState>(() => ({
    phase: isFinishVsEngine ? 'playing' : 'idle',
    fen: payload.initialFen,
    result: null,
  }));
  // Replay history of sans played in finish-game so we can reconstruct lastMove
  const finishSansRef = useRef<string[]>([]);
  // Strictly prevent double engine move
  const engineMoveLockedRef = useRef(false);
  // Request id to discard stale engine responses
  const finishRequestIdRef = useRef(0);

  const requestIdRef = useRef(0);
  const cacheRef = useRef(new Map<string, EvalCacheEntry>());

  // Reset reader state when payload changes
  useEffect(() => {
    setState({
      currentPly: 0,
      variantSans: [],
      branchRootPly: null,
      branchRootFen: null,
    });
  }, [payload.initialFen, payload.title]);

  // Reset finish state when payload changes
  useEffect(() => {
    if (!isFinishVsEngine) return;
    finishSansRef.current = [...(payload.moves?.map((m) => m.san) ?? [])];
    const startFen = payload.moves?.at(-1)?.fenAfter ?? payload.initialFen;
    engineMoveLockedRef.current = false;
    finishRequestIdRef.current = 0;
    setFinishState({ phase: 'playing', fen: startFen, result: null });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload.initialFen, payload.title, isFinishVsEngine]);

  // ──────────────────────────────────────────────────────────────────────────
  // Derived reader data
  // ──────────────────────────────────────────────────────────────────────────
  const currentFen = useMemo(
    () =>
      buildFenFromMoves(
        payload.initialFen,
        mainMoves,
        state.currentPly,
        state.variantSans,
      ),
    [payload.initialFen, mainMoves, state.currentPly, state.variantSans],
  );

  const currentMove =
    state.currentPly > 0 ? (mainMoves[state.currentPly - 1] ?? null) : null;
  const sideToMove = sideFromFen(currentFen);

  const currentEvaluation = useMemo(() => {
    const fromPayload =
      payload.evaluations?.find((e) => e.ply === state.currentPly)
        ?.evaluation ?? null;
    const cached = cacheRef.current.get(currentFen)?.evaluation ?? null;
    return cached ? preferEvaluation(fromPayload, cached) : fromPayload;
  }, [payload.evaluations, state.currentPly, currentFen]);

  // ──────────────────────────────────────────────────────────────────────────
  // Reader navigation
  // ──────────────────────────────────────────────────────────────────────────
  const jumpToPly = useCallback(
    (nextPly: number) => {
      setState({
        currentPly: Math.max(0, Math.min(mainMoves.length, nextPly)),
        variantSans: [],
        branchRootPly: null,
        branchRootFen: null,
      });
    },
    [mainMoves.length],
  );

  const step = useCallback(
    (delta: number) => {
      setState((prev) => ({
        currentPly: Math.max(
          0,
          Math.min(mainMoves.length, prev.currentPly + delta),
        ),
        variantSans: [],
        branchRootPly: null,
        branchRootFen: null,
      }));
    },
    [mainMoves.length],
  );

  const playMove = useCallback(
    (from: string, to: string, promotion = 'q') => {
      setState((prev) => {
        const baseFen = buildFenFromMoves(
          payload.initialFen,
          mainMoves,
          prev.currentPly,
          prev.variantSans,
        );
        const chess = new Chess(baseFen);
        let played: Move | null = null;
        try {
          played = chess.move({
            from,
            to,
            promotion: promotion as 'q' | 'r' | 'b' | 'n',
          }) as Move;
        } catch {
          return prev;
        }
        if (!played) return prev;
        const expected =
          prev.variantSans.length === 0
            ? (mainMoves[prev.currentPly]?.san ?? null)
            : null;
        const isNewVariant =
          prev.variantSans.length === 0 &&
          (expected == null || expected !== played.san);
        return {
          currentPly: prev.currentPly,
          variantSans: [...prev.variantSans, played.san],
          branchRootPly: isNewVariant ? prev.currentPly : prev.branchRootPly,
          branchRootFen: isNewVariant ? baseFen : prev.branchRootFen,
        };
      });
    },
    [payload.initialFen, mainMoves],
  );

  const returnToBranchRoot = useCallback(() => {
    setState((prev) => ({
      currentPly: prev.branchRootPly ?? prev.currentPly,
      variantSans: [],
      branchRootPly: null,
      branchRootFen: null,
    }));
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // Finish-vs-engine: player move
  // ──────────────────────────────────────────────────────────────────────────
  const playFinishMove = useCallback(
    (from: string, to: string, promotion = 'q') => {
      if (!isFinishVsEngine) return;
      setFinishState((prev) => {
        if (prev.phase !== 'playing') return prev;
        if (sideFromFen(prev.fen) === engineColor) return prev;
        const chess = new Chess(prev.fen);
        let played: Move | null = null;
        try {
          played = chess.move({
            from,
            to,
            promotion: promotion as 'q' | 'r' | 'b' | 'n',
          }) as Move;
        } catch {
          return prev;
        }
        if (!played) return prev;
        finishSansRef.current.push(played.san);
        const newFen = chess.fen();
        const officialResult = officialResultFromChess(chess);
        return {
          phase: officialResult ? 'game-over' : 'playing',
          fen: newFen,
          result: officialResult,
        };
      });
    },
    [isFinishVsEngine, engineColor],
  );

  const playFinishSan = useCallback(
    (san: string) => {
      if (!isFinishVsEngine) return;
      setFinishState((prev) => {
        if (prev.phase !== 'playing') return prev;
        if (sideFromFen(prev.fen) === engineColor) return prev;
        const chess = new Chess(prev.fen);
        let played: Move | null = null;
        try {
          played = chess.move(san);
        } catch {
          return prev;
        }
        if (!played) return prev;
        finishSansRef.current.push(played.san);
        const newFen = chess.fen();
        const officialResult = officialResultFromChess(chess);
        return {
          phase: officialResult ? 'game-over' : 'playing',
          fen: newFen,
          result: officialResult,
        };
      });
    },
    [isFinishVsEngine, engineColor],
  );

  const finishLegalDests = useCallback(
    (from: string): string[] => {
      if (!isFinishVsEngine) return [];
      if (sideFromFen(finishState.fen) === engineColor) return [];
      try {
        return new Chess(finishState.fen)
          .moves({ square: from as Parameters<Chess['moves']>[0]['square'], verbose: true })
          .map((m) => m.to);
      } catch {
        return [];
      }
    },
    [isFinishVsEngine, finishState.fen, engineColor],
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Finish-vs-engine: engine move trigger
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isFinishVsEngine) return;
    if (finishState.phase !== 'playing') return;
    if (!engine || !engineReady) return;
    if (sideFromFen(finishState.fen) !== engineColor) return;
    if (engineMoveLockedRef.current) return;

    engineMoveLockedRef.current = true;
    const requestId = ++finishRequestIdRef.current;
    const fenAtRequest = finishState.fen;

    void (async () => {
      try {
        const analysis = await engine.analyze(fenAtRequest, 1500);
        if (requestId !== finishRequestIdRef.current) return;
        if (!analysis.bestMove) return;

        setFinishState((prev) => {
          if (prev.phase !== 'playing') return prev;
          if (prev.fen !== fenAtRequest) return prev;
          const chess = new Chess(prev.fen);
          let played: Move | null = null;
          try {
            played = chess.move({
              from: analysis.bestMove!.from,
              to: analysis.bestMove!.to,
              promotion: 'q',
            }) as Move;
          } catch {
            return prev;
          }
          if (!played) return prev;
          finishSansRef.current.push(played.san);
          const newFen = chess.fen();
          const officialResult = officialResultFromChess(chess);
          engineMoveLockedRef.current = false;
          return {
            phase: officialResult ? 'game-over' : 'playing',
            fen: newFen,
            result: officialResult,
          };
        });
      } catch {
        if (requestId === finishRequestIdRef.current) {
          engineMoveLockedRef.current = false;
        }
      }
    })();
  }, [
    isFinishVsEngine,
    finishState.phase,
    finishState.fen,
    engine,
    engineReady,
    engineColor,
  ]);

  // ──────────────────────────────────────────────────────────────────────────
  // Analysis cache update from payload evaluations
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    setEvalState((prev) => ({
      evaluation: currentEvaluation ?? prev.evaluation,
      bestSan: cacheRef.current.get(currentFen)?.bestSan ?? null,
      thinking: false,
    }));
  }, [currentEvaluation, currentFen]);

  // ──────────────────────────────────────────────────────────────────────────
  // Progressive Stockfish analysis (reader/analysis/free-play modes)
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isFinishVsEngine) return;
    if (!engine || !engineReady) return;
    const cached = cacheRef.current.get(currentFen);
    if (cached) {
      setEvalState({
        evaluation: cached.evaluation,
        bestSan: cached.bestSan,
        thinking: false,
      });
      return;
    }
    const requestId = ++requestIdRef.current;
    setEvalState((prev) => ({
      evaluation: currentEvaluation ?? prev.evaluation,
      bestSan: prev.bestSan,
      thinking: true,
    }));
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const analysis = await engine.analyze(currentFen, 800);
          if (requestId !== requestIdRef.current) return;
          let bestSan: string | null = null;
          if (analysis.bestMove) {
            const chess = new Chess(currentFen);
            const legal = chess.moves({ verbose: true }).find(
              (m) =>
                m.from === analysis.bestMove!.from &&
                m.to === analysis.bestMove!.to,
            );
            bestSan = legal?.san ?? null;
          }
          const evaluation = toWhitePerspectiveEvaluation(
            analysis.scoreCp,
            analysis.mateIn,
          );
          cacheRef.current.set(currentFen, { evaluation, bestSan });
          setEvalState({
            evaluation: preferEvaluation(currentEvaluation, evaluation),
            bestSan,
            thinking: false,
          });
        } catch {
          if (requestId === requestIdRef.current) {
            setEvalState((prev) => ({ ...prev, thinking: false }));
          }
        }
      })();
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [currentFen, currentEvaluation, debounceMs, engine, engineReady, isFinishVsEngine]);

  // ──────────────────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────────────────
  return {
    // Reader
    currentFen,
    currentPly: state.currentPly,
    currentMove,
    evalState,
    mainMoves,
    sideToMove,
    canReturnToBranch: state.branchRootPly != null,
    atStart: state.currentPly === 0 && state.variantSans.length === 0,
    atEnd:
      state.currentPly >= mainMoves.length &&
      state.variantSans.length === 0,
    variantSans: state.variantSans,
    jumpToPly,
    goStart: () => jumpToPly(0),
    goEnd: () => jumpToPly(mainMoves.length),
    goPrev: () => step(-1),
    goNext: () => step(1),
    playMove,
    returnToBranchRoot,
    // Finish-vs-engine
    finishState,
    finishLegalDests,
    playFinishMove,
    playFinishSan,
  };
}
