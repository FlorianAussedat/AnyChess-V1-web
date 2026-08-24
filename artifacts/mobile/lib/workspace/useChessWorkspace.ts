import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Move } from 'chess.js';
import type { DefenseAnalyzer } from '../defendDraw/defenseTypes.ts';
import type { ChessWorkspacePayload, EngineEvaluation, WorkspaceMove } from './types.ts';

export type WorkspaceEvalState = {
  evaluation: EngineEvaluation | null;
  bestSan: string | null;
  thinking: boolean;
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

function sideFromFen(fen: string): 'white' | 'black' {
  return fen.split(' ')[1] === 'b' ? 'black' : 'white';
}

function buildFen(
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

function toWhitePerspectiveEvaluation(scoreCp: number, mateIn: number | null): EngineEvaluation {
  if (typeof mateIn === 'number' && Number.isFinite(mateIn)) {
    return { type: 'mate', value: mateIn, perspective: 'white' };
  }
  return { type: 'cp', value: scoreCp, perspective: 'white' };
}

export function useChessWorkspace(input: {
  payload: ChessWorkspacePayload;
  engine: DefenseAnalyzer | null;
  engineReady: boolean;
  debounceMs?: number;
}) {
  const { payload, engine, engineReady, debounceMs = 160 } = input;
  const mainMoves = payload.moves ?? [];

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

  const requestIdRef = useRef(0);
  const cacheRef = useRef(new Map<string, EvalCacheEntry>());

  useEffect(() => {
    setState({
      currentPly: 0,
      variantSans: [],
      branchRootPly: null,
      branchRootFen: null,
    });
  }, [payload.initialFen, payload.title]);

  const currentFen = useMemo(
    () => buildFen(payload.initialFen, mainMoves, state.currentPly, state.variantSans),
    [payload.initialFen, mainMoves, state.currentPly, state.variantSans],
  );

  const currentMove = state.currentPly > 0 ? mainMoves[state.currentPly - 1] ?? null : null;
  const sideToMove = sideFromFen(currentFen);

  const moveSans = useMemo(
    () => [...mainMoves.map((move) => move.san), ...state.variantSans],
    [mainMoves, state.variantSans],
  );

  const currentEvaluation = useMemo(() => {
    const fromPayload = payload.evaluations?.find((entry) => entry.ply === state.currentPly)?.evaluation ?? null;
    const cached = cacheRef.current.get(currentFen)?.evaluation ?? null;
    return cached ? preferEvaluation(fromPayload, cached) : fromPayload;
  }, [payload.evaluations, state.currentPly, currentFen]);

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
      jumpToPly(state.currentPly + delta);
    },
    [jumpToPly, state.currentPly],
  );

  const playMove = useCallback(
    (from: string, to: string, promotion = 'q') => {
      setState((prev) => {
        const baseFen = buildFen(payload.initialFen, mainMoves, prev.currentPly, prev.variantSans);
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
        const expected = prev.variantSans.length === 0 ? mainMoves[prev.currentPly]?.san ?? null : null;
        const isNewVariant =
          prev.variantSans.length === 0 && (expected == null || expected !== played.san);
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

  useEffect(() => {
    setEvalState((prev) => ({
      evaluation: currentEvaluation ?? prev.evaluation,
      bestSan: cacheRef.current.get(currentFen)?.bestSan ?? null,
      thinking: false,
    }));
  }, [currentEvaluation, currentFen]);

  useEffect(() => {
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
              (move) => move.from === analysis.bestMove!.from && move.to === analysis.bestMove!.to,
            );
            bestSan = legal?.san ?? null;
          }
          const evaluation = toWhitePerspectiveEvaluation(analysis.scoreCp, analysis.mateIn);
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
  }, [currentFen, currentEvaluation, debounceMs, engine, engineReady]);

  return {
    currentFen,
    currentPly: state.currentPly,
    currentMove,
    evalState,
    mainMoves,
    moveSans,
    sideToMove,
    canReturnToBranch: state.branchRootPly != null,
    atStart: state.currentPly === 0 && state.variantSans.length === 0,
    atEnd: state.currentPly >= mainMoves.length && state.variantSans.length === 0,
    variantSans: state.variantSans,
    jumpToPly,
    goStart: () => jumpToPly(0),
    goEnd: () => jumpToPly(mainMoves.length),
    goPrev: () => step(-1),
    goNext: () => step(1),
    playMove,
    returnToBranchRoot,
  };
}
