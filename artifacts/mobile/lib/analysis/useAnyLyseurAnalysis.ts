/**
 * React binding for AnalysisController — auto position + full-game analysis.
 * Auto-start does not depend on the Analyse tab; it waits for engine ready.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReaderGame } from '@/lib/gameReader';
import { AnalysisController } from './AnalysisController.ts';
import { createChessEngine } from './engine/createChessEngine.ts';
import {
  collectActiveLineNodes,
  collectMainLineNodes,
} from './mainLineNodes.ts';
import {
  collectVariantNodesForAnalysis,
  orderNodesForBackgroundAnalysis,
} from './orderBackgroundAnalysis.ts';
import type { AnalysisProfileId, AnalysisSessionState } from './types.ts';

export type UseAnyLyseurAnalysisOptions = {
  game: ReaderGame | null;
  currentFen: string | null;
  currentNodeId: string | null;
  activeLineNodeIds: string[];
  analyzeActiveBranch?: boolean;
  active?: boolean;
};

function analysisDevLog(message: string): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // eslint-disable-next-line no-console
    console.log(message);
  }
}

export function useAnyLyseurAnalysis(options: UseAnyLyseurAnalysisOptions) {
  const {
    game,
    currentFen,
    currentNodeId,
    activeLineNodeIds,
    analyzeActiveBranch = true,
    active = true,
  } = options;

  const [state, setState] = useState<AnalysisSessionState | null>(null);
  const controllerRef = useRef<AnalysisController | null>(null);
  const gameRef = useRef(game);
  const currentFenRef = useRef(currentFen);
  const activeLineRef = useRef(activeLineNodeIds);
  gameRef.current = game;
  currentFenRef.current = currentFen;
  activeLineRef.current = activeLineNodeIds;

  const fingerprint = game?.fingerprint ?? game?.id ?? null;

  useEffect(() => {
    const engine = createChessEngine();
    const controller = new AnalysisController({
      engine,
      onChange: setState,
    });
    controllerRef.current = controller;
    setState(controller.getState());
    void controller.init();
    return () => {
      void controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  // Current position — always preempts; does not restart the full-game queue.
  useEffect(() => {
    if (!active) {
      void controllerRef.current?.pause();
      return;
    }
    if (!currentFen || !controllerRef.current) return;
    void controllerRef.current.analyzeCurrentPosition(currentFen);
  }, [currentFen, active]);

  const startFullGameAnalysis = useCallback((g: ReaderGame) => {
    const ctrl = controllerRef.current;
    if (!ctrl) return;
    const main = collectMainLineNodes(g);
    const mainSpecs = [
      { nodeId: `${g.id}::start`, fen: g.initialFen },
      ...main.map((n) => ({ nodeId: n.nodeId, fen: n.fen })),
    ];
    const variantSpecs = collectVariantNodesForAnalysis(g);
    const activeNodes = collectActiveLineNodes(g, activeLineRef.current);
    const activeSpecs = activeNodes.map((n) => ({
      nodeId: n.nodeId,
      fen: n.fen,
    }));
    const ordered = orderNodesForBackgroundAnalysis({
      mainLine: mainSpecs,
      activeLine: activeSpecs,
      currentFen: currentFenRef.current,
      variantNodes: variantSpecs,
    });
    analysisDevLog(`Analysis auto start: ${g.id}`);
    ctrl.startGameAnalysis(ordered, {
      sessionId: g.id,
      fingerprint: g.fingerprint ?? g.id,
      asMainLine: true,
      mainLineNodeIds: mainSpecs.map((n) => n.nodeId),
      variantNodeIds: variantSpecs.map((n) => n.nodeId),
      progressNodeIds: mainSpecs.map((n) => n.nodeId),
    });
  }, []);

  // Full-game auto analysis — keyed by game identity (not cursor FEN).
  useEffect(() => {
    if (!active || !game || !controllerRef.current) return;
    startFullGameAnalysis(game);
  }, [game?.id, fingerprint, active, startFullGameAnalysis]);

  // If the Worker becomes ready after the game effect ran while initializing,
  // resume the queued analysis automatically.
  const prevEngineStatus = useRef<string | null>(null);
  useEffect(() => {
    const status = state?.engineStatus ?? null;
    const becameReady =
      prevEngineStatus.current === 'initializing' && status === 'ready';
    prevEngineStatus.current = status;
    if (!becameReady || !active || !game || !controllerRef.current) return;
    startFullGameAnalysis(game);
  }, [state?.engineStatus, active, game, startFullGameAnalysis]);

  // Side-branch boost when the user navigates into a variation (optional).
  useEffect(() => {
    if (!active || !analyzeActiveBranch || !game || !controllerRef.current)
      return;
    const mainIds = new Set(collectMainLineNodes(game).map((n) => n.nodeId));
    const onBranch = activeLineNodeIds.some((id) => !mainIds.has(id));
    if (!onBranch) return;
    const branch = collectActiveLineNodes(game, activeLineNodeIds);
    controllerRef.current.analyzeBranchNodes(
      branch.map((n) => ({ nodeId: n.nodeId, fen: n.fen })),
      game.id,
    );
  }, [game?.id, activeLineNodeIds.join('|'), analyzeActiveBranch, active]);

  const setProfile = useCallback((profileId: AnalysisProfileId) => {
    controllerRef.current?.setProfile(profileId);
  }, []);

  const reanalyze = useCallback(
    async (profileId?: AnalysisProfileId) => {
      if (!currentFen || !controllerRef.current) return;
      await controllerRef.current.reanalyze(currentFen, profileId);
      if (game) startFullGameAnalysis(game);
    },
    [currentFen, game, startFullGameAnalysis],
  );

  const setArrowsEnabled = useCallback((enabled: boolean) => {
    controllerRef.current?.setArrowsEnabled(enabled);
  }, []);

  const retryEngine = useCallback(async () => {
    const previous = controllerRef.current;
    const engine = createChessEngine();
    const controller = new AnalysisController({
      engine,
      onChange: setState,
    });
    controllerRef.current = controller;
    if (previous) await previous.dispose();
    setState(controller.getState());
    await controller.init();
    if (currentFen) await controller.analyzeCurrentPosition(currentFen);
    if (game) startFullGameAnalysis(game);
  }, [currentFen, game, startFullGameAnalysis]);

  const classificationInputs = useMemo(() => {
    if (!controllerRef.current || !game || !currentNodeId) return null;
    const node = game.nodesById[currentNodeId];
    if (!node) return null;
    return controllerRef.current.getClassificationInputs({
      fenBefore: node.fenBefore,
      fenAfter: node.fenAfter,
      playedMoveSan: node.san,
      playedMoveUci:
        node.from && node.to
          ? `${node.from}${node.to}${node.promotion ?? ''}`
          : null,
    });
  }, [game, currentNodeId, state?.position, state?.gameNodes]);

  const displayPosition = useMemo(() => {
    if (!state?.position || !currentFen) return null;
    if (state.position.fen !== currentFen) return null;
    if (state.position.profileId !== state.profileId) return null;
    return state.position;
  }, [state?.position, state?.profileId, currentFen]);

  return {
    state,
    displayPosition,
    setProfile,
    reanalyze,
    setArrowsEnabled,
    retryEngine,
    classificationInputs,
    isMainLineFullyAnalyzed: state?.mainLineComplete ?? false,
    isGameFullyAnalyzed: state?.gameComplete ?? false,
  };
}
