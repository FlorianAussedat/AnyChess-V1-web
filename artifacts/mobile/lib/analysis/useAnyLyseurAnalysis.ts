/**
 * React binding for AnalysisController — auto position + main-line game analysis.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReaderGame } from '@/lib/gameReader';
import { AnalysisController } from './AnalysisController.ts';
import { createChessEngine } from './engine/createChessEngine.ts';
import {
  collectActiveLineNodes,
  collectMainLineNodes,
} from './mainLineNodes.ts';
import { orderNodesForBackgroundAnalysis } from './orderBackgroundAnalysis.ts';
import type { AnalysisProfileId, AnalysisSessionState } from './types.ts';

export type UseAnyLyseurAnalysisOptions = {
  game: ReaderGame | null;
  currentFen: string | null;
  currentNodeId: string | null;
  activeLineNodeIds: string[];
  /** When true, also analyze the active branch after entering a side line. */
  analyzeActiveBranch?: boolean;
  /** Pause engine work when the screen is not focused. */
  active?: boolean;
};

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
  const activeLineKey = activeLineNodeIds.join('|');

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

  useEffect(() => {
    if (!active) {
      void controllerRef.current?.pause();
      return;
    }
    if (!currentFen || !controllerRef.current) return;
    void controllerRef.current.analyzeCurrentPosition(currentFen);
  }, [currentFen, active]);

  useEffect(() => {
    if (!active || !game || !controllerRef.current) return;
    const main = collectMainLineNodes(game);
    const mainSpecs = [
      { nodeId: `${game.id}::start`, fen: game.initialFen },
      ...main.map((n) => ({ nodeId: n.nodeId, fen: n.fen })),
    ];
    const activeNodes = collectActiveLineNodes(game, activeLineNodeIds);
    const activeSpecs = activeNodes.map((n) => ({
      nodeId: n.nodeId,
      fen: n.fen,
    }));
    const ordered = orderNodesForBackgroundAnalysis({
      mainLine: mainSpecs,
      activeLine: activeSpecs,
      currentFen,
    });
    controllerRef.current.startGameAnalysis(ordered, {
      sessionId: game.id,
      asMainLine: true,
      progressNodeIds: mainSpecs.map((n) => n.nodeId),
    });
  }, [game?.id, active, currentFen, activeLineKey]);

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
  }, [game?.id, activeLineKey, analyzeActiveBranch, active]);

  const setProfile = useCallback((profileId: AnalysisProfileId) => {
    controllerRef.current?.setProfile(profileId);
  }, []);

  const reanalyze = useCallback(
    async (profileId?: AnalysisProfileId) => {
      if (!currentFen || !controllerRef.current) return;
      await controllerRef.current.reanalyze(currentFen, profileId);
      if (game) {
        const main = collectMainLineNodes(game);
        controllerRef.current.startGameAnalysis(
          [
            { nodeId: `${game.id}::start`, fen: game.initialFen },
            ...main.map((n) => ({ nodeId: n.nodeId, fen: n.fen })),
          ],
          { sessionId: game.id, asMainLine: true },
        );
      }
    },
    [currentFen, game],
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
    if (game) {
      const main = collectMainLineNodes(game);
      controller.startGameAnalysis(
        [
          { nodeId: `${game.id}::start`, fen: game.initialFen },
          ...main.map((n) => ({ nodeId: n.nodeId, fen: n.fen })),
        ],
        { sessionId: game.id, asMainLine: true },
      );
    }
  }, [currentFen, game]);

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

  /** Displayed analysis only when it matches the current FEN + profile. */
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
  };
}
