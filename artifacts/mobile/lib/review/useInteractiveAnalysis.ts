/**
 * Interactive analysis state — free moves, main line, variant branch root.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Chess, type Move } from 'chess.js';
import type { DefenseAnalyzer } from '../defendDraw/defenseTypes.ts';
import {
  normalizeForDefender,
  sideToMoveFromFen,
} from '../endgameTraining/domain/EvaluationNormalizer.ts';
import type { DefenderColor } from '../endgameTraining/domain/types.ts';

export type AnalysisLineState = {
  fen: string;
  /** Index in main moveSans (0 = start). */
  mainPly: number;
  /** Extra SAN plies after branching from main line. */
  variantSans: string[];
  branchRootFen: string | null;
  branchRootPly: number | null;
};

export type AnalysisEval = {
  scoreCp: number;
  mateIn: number | null;
  bestSan: string | null;
  thinking: boolean;
};

function buildFenFromLine(
  startFen: string,
  mainSans: string[],
  mainPly: number,
  variantSans: string[],
): string {
  const g = new Chess(startFen);
  for (let i = 0; i < mainPly && i < mainSans.length; i++) {
    g.move(mainSans[i]!);
  }
  for (const san of variantSans) {
    g.move(san);
  }
  return g.fen();
}

export function useInteractiveAnalysis(opts: {
  startFen: string;
  moveSans: string[];
  orientation: DefenderColor;
  engine: DefenseAnalyzer | null;
  engineReady: boolean;
  debounceMs?: number;
}) {
  const { startFen, moveSans, orientation, engine, engineReady, debounceMs = 200 } =
    opts;

  const [line, setLine] = useState<AnalysisLineState>(() => ({
    fen: startFen,
    mainPly: 0,
    variantSans: [],
    branchRootFen: null,
    branchRootPly: null,
  }));

  const [evalState, setEvalState] = useState<AnalysisEval>({
    scoreCp: 0,
    mateIn: null,
    bestSan: null,
    thinking: false,
  });

  const reqId = useRef(0);

  const syncFen = useCallback(
    (next: Partial<AnalysisLineState>) => {
      setLine((prev) => {
        const merged = { ...prev, ...next };
        const fen = buildFenFromLine(
          startFen,
          moveSans,
          merged.mainPly,
          merged.variantSans,
        );
        return { ...merged, fen };
      });
    },
    [startFen, moveSans],
  );

  const goToMainPly = useCallback(
    (ply: number) => {
      syncFen({
        mainPly: Math.max(0, Math.min(moveSans.length, ply)),
        variantSans: [],
        branchRootFen: null,
        branchRootPly: null,
      });
    },
    [moveSans.length, syncFen],
  );

  const stepMain = useCallback(
    (delta: number) => {
      setLine((prev) => {
        const nextPly = Math.max(0, Math.min(moveSans.length, prev.mainPly + delta));
        return {
          ...prev,
          mainPly: nextPly,
          variantSans: [],
          branchRootFen: null,
          branchRootPly: null,
          fen: buildFenFromLine(startFen, moveSans, nextPly, []),
        };
      });
    },
    [startFen, moveSans],
  );

  const tryFreeMove = useCallback(
    (from: string, to: string, promotion = 'q') => {
      setLine((prev) => {
        const g = new Chess(prev.fen);
        let played: Move | null = null;
        try {
          played = g.move({
            from,
            to,
            promotion: promotion as 'q' | 'r' | 'b' | 'n',
          }) as Move;
        } catch {
          return prev;
        }
        if (!played) return prev;

        const isFirstVariant =
          prev.variantSans.length === 0 &&
          (prev.mainPly < moveSans.length
            ? played.san !== moveSans[prev.mainPly]
            : true);

        const variantSans = [...prev.variantSans, played.san];
        const branchRootFen = isFirstVariant ? prev.fen : prev.branchRootFen;
        const branchRootPly = isFirstVariant ? prev.mainPly : prev.branchRootPly;

        return {
          ...prev,
          variantSans,
          branchRootFen,
          branchRootPly,
          fen: g.fen(),
        };
      });
    },
    [moveSans],
  );

  const returnToBranchRoot = useCallback(() => {
    setLine((prev) => {
      if (!prev.branchRootFen) return prev;
      return {
        ...prev,
        fen: prev.branchRootFen,
        mainPly: prev.branchRootPly ?? prev.mainPly,
        variantSans: [],
        branchRootFen: null,
        branchRootPly: null,
      };
    });
  }, []);

  useEffect(() => {
    if (!engine || !engineReady) return;
    const id = ++reqId.current;
    setEvalState((s) => ({ ...s, thinking: true }));

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const analysis = await engine.analyze(line.fen, 800);
          if (id !== reqId.current) return;

          const norm = normalizeForDefender(
            {
              scoreCp: analysis.scoreCp,
              mateIn: analysis.mateIn,
              sideToMove: sideToMoveFromFen(line.fen),
            },
            orientation,
          );

          let bestSan: string | null = null;
          if (analysis.bestMove) {
            const g = new Chess(line.fen);
            const m = g.moves({ verbose: true }).find(
              (mv) =>
                mv.from === analysis.bestMove!.from &&
                mv.to === analysis.bestMove!.to,
            );
            bestSan = m?.san ?? null;
          }

          setEvalState({
            scoreCp: norm.scoreCp,
            mateIn: norm.mateIn,
            bestSan,
            thinking: false,
          });
        } catch {
          if (id === reqId.current) {
            setEvalState((s) => ({ ...s, thinking: false }));
          }
        }
      })();
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [line.fen, engine, engineReady, orientation, debounceMs]);

  const gameOver = useCallback(() => {
    try {
      return new Chess(line.fen).isGameOver();
    } catch {
      return true;
    }
  }, [line.fen]);

  return {
    line,
    evalState,
    goToMainPly,
    stepMain,
    tryFreeMove,
    returnToBranchRoot,
    gameOver: gameOver(),
    atStart: line.mainPly === 0 && line.variantSans.length === 0,
    atEnd: line.mainPly >= moveSans.length && line.variantSans.length === 0,
    canReturnToBranch: line.branchRootFen != null,
  };
}
