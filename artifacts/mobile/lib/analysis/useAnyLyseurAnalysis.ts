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
import type { AnalysisProfileId, AnalysisSessionState } from './types.ts';

export type UseAnyLyseurAnalysisOptions = {
  game: ReaderGame | null;
  currentFen: string | null;
  currentNodeId: string | null;
  activeLineNodeIds: string[];
  /** When true, also analyze the active branch after entering a side line. */
  analyzeActiveBranch?: boolean;
};

export function useAnyLyseurAnalysis(options: UseAnyLyseurAnalysisOptions) {
  const {
    game,
    currentFen,
    currentNodeId,
    activeLineNodeIds,
    analyzeActiveBranch = true,
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
    if (!currentFen || !controllerRef.current) return;
    void controllerRef.current.analyzeCurrentPosition(currentFen);
  }, [currentFen]);

  useEffect(() => {
    if (!game || !controllerRef.current) return;
    const main = collectMainLineNodes(game);
    controllerRef.current.startGameAnalysis([
      { nodeId: `${game.id}::start`, fen: game.initialFen },
      ...main.map((n) => ({ nodeId: n.nodeId, fen: n.fen })),
    ]);
  }, [game?.id]);

  useEffect(() => {
    if (!analyzeActiveBranch || !game || !controllerRef.current) return;
    const mainIds = new Set(collectMainLineNodes(game).map((n) => n.nodeId));
    const onBranch = activeLineNodeIds.some((id) => !mainIds.has(id));
    if (!onBranch) return;
    const branch = collectActiveLineNodes(game, activeLineNodeIds);
    controllerRef.current.startGameAnalysis(
      branch.map((n) => ({ nodeId: n.nodeId, fen: n.fen })),
    );
  }, [game?.id, activeLineKey, analyzeActiveBranch]);

  const setProfile = useCallback((profileId: AnalysisProfileId) => {
    controllerRef.current?.setProfile(profileId);
  }, []);

  const reanalyze = useCallback(
    async (profileId?: AnalysisProfileId) => {
      if (!currentFen || !controllerRef.current) return;
      await controllerRef.current.reanalyze(currentFen, profileId);
      if (game) {
        const main = collectMainLineNodes(game);
        controllerRef.current.startGameAnalysis([
          { nodeId: `${game.id}::start`, fen: game.initialFen },
          ...main.map((n) => ({ nodeId: n.nodeId, fen: n.fen })),
        ]);
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
      controller.startGameAnalysis([
        { nodeId: `${game.id}::start`, fen: game.initialFen },
        ...main.map((n) => ({ nodeId: n.nodeId, fen: n.fen })),
      ]);
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

  return {
    state,
    setProfile,
    reanalyze,
    setArrowsEnabled,
    retryEngine,
    classificationInputs,
  };
}
