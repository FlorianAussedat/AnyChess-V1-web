/**
 * Core hook for the universal chess workspace.
 * Navigation and variants are backed by an immutable node tree.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { DefenseAnalyzer } from '../defendDraw/defenseTypes.ts';
import type {
  ChessWorkspacePayload,
  EngineEvaluation,
  WorkspaceMove,
} from './types.ts';
import {
  childChoices,
  createTreeFromPayload,
  currentNode,
  goEnd as treeGoEnd,
  goNext as treeGoNext,
  goPrev as treeGoPrev,
  goStart as treeGoStart,
  jumpToActivePly,
  lastMoveOnPath,
  legalDestinations as treeLegalDestinations,
  mainlineMoves,
  playSan as treePlaySan,
  playUci,
  preferEvaluation,
  returnToDivergence,
  selectNode,
  setNodeEvaluation,
  sideFromFen,
  activePathMoves,
  type VariantChoice,
  type VariantTree,
} from './variantTree.ts';
import {
  createFinishGameController,
  type FinishGameController,
} from './finishGameController.ts';
import {
  analysisCacheKey,
  createAnalysisQueue,
  planAnalysisTasks,
} from './analysisQueue.ts';

export { sideFromFen };

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

type EvalCacheEntry = {
  evaluation: EngineEvaluation;
  bestSan: string | null;
};

/** Linear helper kept for payload tests. */
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

function toWhitePerspectiveEvaluation(
  scoreCp: number,
  mateIn: number | null,
): EngineEvaluation {
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
  const { payload, engine, engineReady } = input;
  const isFinishVsEngine = payload.workspaceMode === 'finish-vs-engine';

  const [tree, setTree] = useState<VariantTree>(() => createTreeFromPayload(payload));
  const [evalState, setEvalState] = useState<WorkspaceEvalState>({
    evaluation: null,
    bestSan: null,
    thinking: false,
  });

  const [displayOrientation, setDisplayOrientation] = useState<'white' | 'black'>(
    payload.orientation,
  );

  const [finishState, setFinishState] = useState<WorkspaceFinishState>(() => ({
    phase: isFinishVsEngine ? 'playing' : 'idle',
    fen: payload.initialFen,
    result: null,
  }));
  const finishControllerRef = useRef<FinishGameController | null>(null);
  const requestIdRef = useRef(0);
  const cacheRef = useRef(new Map<string, EvalCacheEntry>());
  const analysisQueueRef = useRef(createAnalysisQueue({ maxCache: 64 }));
  const pumpingRef = useRef(false);
  const treeRef = useRef<VariantTree>(null as unknown as VariantTree);
  const currentNodeIdRef = useRef('');

  useEffect(() => {
    setTree(createTreeFromPayload(payload));
    setDisplayOrientation(payload.orientation);
  }, [payload.initialFen, payload.title, payload.workspaceMode, payload.orientation]);

  useEffect(() => {
    finishControllerRef.current?.close();
    finishControllerRef.current = null;
    if (!isFinishVsEngine) {
      setFinishState({ phase: 'idle', fen: payload.initialFen, result: null });
      return;
    }
    const playerColor =
      payload.playerColor ??
      (payload.engineOpponent?.color === 'white' ? 'black' : 'white');
    const engineColor = payload.engineOpponent?.color ?? (playerColor === 'white' ? 'black' : 'white');
    const controller = createFinishGameController({
      initialFen: payload.initialFen,
      playerColor,
      engineColor,
      openingSans: payload.moves?.map((move) => move.san) ?? [],
      onStateChange: (state) => {
        setFinishState({
          phase:
            state.phase === 'game-over'
              ? 'game-over'
              : state.phase === 'playing' || state.phase === 'error'
                ? 'playing'
                : 'idle',
          fen: state.fen,
          result: state.result,
        });
      },
    });
    finishControllerRef.current = controller;
    const snap = controller.getState();
    setFinishState({
      phase: snap.phase === 'game-over' ? 'game-over' : 'playing',
      fen: snap.fen,
      result: snap.result,
    });
    return () => {
      controller.close();
      if (finishControllerRef.current === controller) {
        finishControllerRef.current = null;
      }
    };
  }, [
    payload.initialFen,
    payload.title,
    isFinishVsEngine,
    payload.playerColor,
    payload.engineOpponent?.color,
    payload.moves,
  ]);

  const node = currentNode(tree);
  const currentFen = node.fen;
  const currentPly = node.ply;
  const sideToMove = sideFromFen(currentFen);
  const mainMoves = useMemo(() => mainlineMoves(tree), [tree]);
  const pathMoves = useMemo(() => activePathMoves(tree), [tree]);
  const currentMove = pathMoves[pathMoves.length - 1] ?? null;
  const variantChoices: VariantChoice[] = useMemo(() => childChoices(tree), [tree]);
  const lastMove = lastMoveOnPath(tree);
  treeRef.current = tree;
  currentNodeIdRef.current = tree.currentNodeId;

  const currentEvaluation =
    node.evaluation ??
    cacheRef.current.get(currentFen)?.evaluation ??
    payload.evaluations?.find((entry) => entry.ply === currentPly)?.evaluation ??
    null;

  const jumpToPly = useCallback((nextPly: number) => {
    setTree((prev) => jumpToActivePly(prev, nextPly));
  }, []);

  const playMove = useCallback((from: string, to: string, promotion = 'q') => {
    setTree((prev) => playUci(prev, from, to, promotion) ?? prev);
  }, []);

  const playSan = useCallback((san: string) => {
    setTree((prev) => treePlaySan(prev, san) ?? prev);
  }, []);

  const selectVariant = useCallback((nodeId: string) => {
    setTree((prev) => selectNode(prev, nodeId) ?? prev);
  }, []);

  const returnToBranchRoot = useCallback(() => {
    setTree((prev) => returnToDivergence(prev));
  }, []);

  const flipBoard = useCallback(() => {
    setDisplayOrientation((prev) => (prev === 'white' ? 'black' : 'white'));
  }, []);

  const playFinishMove = useCallback(
    (from: string, to: string, promotion = 'q') => {
      finishControllerRef.current?.submitPlayerMove({ from, to, promotion });
    },
    [],
  );

  const playFinishSan = useCallback((san: string) => {
    finishControllerRef.current?.submitPlayerMove({ san });
  }, []);

  const finishLegalDests = useCallback(
    (from: string): string[] => {
      return finishControllerRef.current?.legalDestinations(from) ?? [];
    },
    [finishState.fen, finishState.phase],
  );

  useEffect(() => {
    if (!isFinishVsEngine) return;
    if (finishState.phase !== 'playing') return;
    if (!engine || !engineReady) return;
    const controller = finishControllerRef.current;
    if (!controller) return;
    const request = controller.requestEngineMoveIfNeeded();
    if (!request.requested || request.token == null) return;
    const token = request.token;
    const fenAtRequest = request.fen;
    void (async () => {
      try {
        const analysis = await engine.analyze(fenAtRequest, 1500);
        if (!analysis.bestMove) {
          controller.receiveEngineError(token, 'no-move');
          return;
        }
        controller.receiveEngineMove(token, fenAtRequest, {
          from: analysis.bestMove.from,
          to: analysis.bestMove.to,
          promotion: analysis.bestMove.promotion,
        });
      } catch (error) {
        controller.receiveEngineError(
          token,
          error instanceof Error ? error.message : 'engine-error',
        );
      }
    })();
  }, [
    isFinishVsEngine,
    finishState.phase,
    finishState.fen,
    engine,
    engineReady,
  ]);

  useEffect(() => {
    setEvalState((prev) => ({
      evaluation: currentEvaluation ?? prev.evaluation,
      bestSan: cacheRef.current.get(currentFen)?.bestSan ?? null,
      thinking: false,
    }));
  }, [currentEvaluation, currentFen]);

  useEffect(() => {
    const queue = analysisQueueRef.current;
    return () => {
      queue.close();
    };
  }, []);

  useEffect(() => {
    if (isFinishVsEngine) return;
    if (!engine || !engineReady) return;
    const queue = analysisQueueRef.current;
    const latestTree = treeRef.current;
    const plan = planAnalysisTasks(latestTree);
    let displayedCached = false;
    for (const item of plan) {
      const status = queue.enqueue({
        nodeId: item.nodeId,
        fen: item.fen,
        priority: item.priority,
        params: { movetimeMs: 800, depth: 12 },
      });
      if (status === 'cached' && item.priority === 1) {
        const cached = queue.getCachedResult(analysisCacheKey(item.nodeId, item.fen));
        if (cached) {
          displayedCached = true;
          cacheRef.current.set(item.fen, {
            evaluation: cached.evaluation,
            bestSan: cached.bestSan,
          });
          setEvalState({
            evaluation: cached.evaluation,
            bestSan: cached.bestSan,
            thinking: false,
          });
          setTree((prev) => setNodeEvaluation(prev, item.nodeId, cached.evaluation));
        }
      }
    }
    queue.promote(latestTree.currentNodeId, 1);
    if (!displayedCached) {
      setEvalState((prev) => ({
        evaluation: currentEvaluation ?? prev.evaluation,
        bestSan: prev.bestSan,
        thinking: true,
      }));
    }

    const pump = async () => {
      if (pumpingRef.current) return;
      pumpingRef.current = true;
      try {
        while (true) {
          const task = queue.next();
          if (!task) return;
          try {
            const analysis = await engine.analyze(task.fen, task.params.movetimeMs);
            let bestSan: string | null = null;
            if (analysis.bestMove) {
              const chess = new Chess(task.fen);
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
            const depth = analysis.depth ?? task.params.depth ?? 0;
            const accepted = queue.complete(task.token, task.nodeId, task.fen, {
              evaluation: { ...evaluation, depth },
              bestSan,
              depth,
            });
            if (!accepted) continue;
            cacheRef.current.set(task.fen, { evaluation, bestSan });
            setTree((prev) => setNodeEvaluation(prev, task.nodeId, { ...evaluation, depth }));
            if (task.nodeId === currentNodeIdRef.current) {
              setEvalState({
                evaluation: preferEvaluation(null, { ...evaluation, depth }),
                bestSan,
                thinking: false,
              });
            }
          } catch {
            queue.fail(task.token, task.nodeId);
            if (task.nodeId === currentNodeIdRef.current) {
              setEvalState((prev) => ({ ...prev, thinking: false }));
            }
          }
        }
      } finally {
        pumpingRef.current = false;
      }
    };
    void pump();
  }, [
    currentFen,
    currentEvaluation,
    engine,
    engineReady,
    isFinishVsEngine,
    tree.currentNodeId,
    tree.mainlineNodeIds.join('|'),
    tree.activePathNodeIds.join('|'),
  ]);

  return {
    currentFen,
    currentPly,
    currentMove,
    currentNodeId: tree.currentNodeId,
    evalState,
    mainMoves,
    pathMoves,
    sideToMove,
    lastMove,
    displayOrientation,
    flipBoard,
    variantChoices,
    selectedChildId: tree.preferredChildByParentId[tree.currentNodeId] ?? null,
    canReturnToBranch: tree.divergenceNodeId != null,
    atStart: currentPly === 0,
    atEnd: currentNode(tree).childrenIds.length === 0,
    jumpToPly,
    goStart: () => setTree((prev) => treeGoStart(prev)),
    goEnd: () => setTree((prev) => treeGoEnd(prev)),
    goPrev: () => setTree((prev) => treeGoPrev(prev)),
    goNext: () => setTree((prev) => treeGoNext(prev)),
    playMove,
    playSan,
    selectVariant,
    returnToBranchRoot,
    legalDestinations: (from: string) => treeLegalDestinations(currentFen, from),
    finishState,
    finishLegalDests,
    playFinishMove,
    playFinishSan,
  };
}
