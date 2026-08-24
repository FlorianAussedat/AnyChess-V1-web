/**
 * Core hook for the universal chess workspace.
 * Navigation and variants are backed by an immutable node tree.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Move } from 'chess.js';
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

  const [tree, setTree] = useState<VariantTree>(() => createTreeFromPayload(payload));
  const [evalState, setEvalState] = useState<WorkspaceEvalState>({
    evaluation: null,
    bestSan: null,
    thinking: false,
  });

  const [finishState, setFinishState] = useState<WorkspaceFinishState>(() => ({
    phase: isFinishVsEngine ? 'playing' : 'idle',
    fen: payload.initialFen,
    result: null,
  }));
  const finishSansRef = useRef<string[]>([]);
  const engineMoveLockedRef = useRef(false);
  const finishRequestIdRef = useRef(0);
  const requestIdRef = useRef(0);
  const cacheRef = useRef(new Map<string, EvalCacheEntry>());

  useEffect(() => {
    setTree(createTreeFromPayload(payload));
  }, [payload.initialFen, payload.title, payload.workspaceMode]);

  useEffect(() => {
    if (!isFinishVsEngine) return;
    finishSansRef.current = [...(payload.moves?.map((m) => m.san) ?? [])];
    const startFen = payload.moves?.at(-1)?.fenAfter ?? payload.initialFen;
    engineMoveLockedRef.current = false;
    finishRequestIdRef.current = 0;
    setFinishState({ phase: 'playing', fen: startFen, result: null });
  }, [payload.initialFen, payload.title, isFinishVsEngine, payload.moves]);

  const node = currentNode(tree);
  const currentFen = node.fen;
  const currentPly = node.ply;
  const sideToMove = sideFromFen(currentFen);
  const mainMoves = useMemo(() => mainlineMoves(tree), [tree]);
  const pathMoves = useMemo(() => activePathMoves(tree), [tree]);
  const currentMove = pathMoves[pathMoves.length - 1] ?? null;
  const variantChoices: VariantChoice[] = useMemo(() => childChoices(tree), [tree]);
  const lastMove = lastMoveOnPath(tree);

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
        const officialResult = officialResultFromChess(chess);
        return {
          phase: officialResult ? 'game-over' : 'playing',
          fen: chess.fen(),
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
        const officialResult = officialResultFromChess(chess);
        return {
          phase: officialResult ? 'game-over' : 'playing',
          fen: chess.fen(),
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
      return treeLegalDestinations(finishState.fen, from);
    },
    [isFinishVsEngine, finishState.fen, engineColor],
  );

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
          const officialResult = officialResultFromChess(chess);
          engineMoveLockedRef.current = false;
          return {
            phase: officialResult ? 'game-over' : 'playing',
            fen: chess.fen(),
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

  useEffect(() => {
    setEvalState((prev) => ({
      evaluation: currentEvaluation ?? prev.evaluation,
      bestSan: cacheRef.current.get(currentFen)?.bestSan ?? null,
      thinking: false,
    }));
  }, [currentEvaluation, currentFen]);

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
      setTree((prev) => setNodeEvaluation(prev, prev.currentNodeId, cached.evaluation));
      return;
    }
    const requestId = ++requestIdRef.current;
    const nodeId = tree.currentNodeId;
    const fen = currentFen;
    setEvalState((prev) => ({
      evaluation: currentEvaluation ?? prev.evaluation,
      bestSan: prev.bestSan,
      thinking: true,
    }));
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const analysis = await engine.analyze(fen, 800);
          if (requestId !== requestIdRef.current) return;
          let bestSan: string | null = null;
          if (analysis.bestMove) {
            const chess = new Chess(fen);
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
          cacheRef.current.set(fen, { evaluation, bestSan });
          setTree((prev) => setNodeEvaluation(prev, nodeId, evaluation));
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
  }, [
    currentFen,
    currentEvaluation,
    debounceMs,
    engine,
    engineReady,
    isFinishVsEngine,
    tree.currentNodeId,
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
