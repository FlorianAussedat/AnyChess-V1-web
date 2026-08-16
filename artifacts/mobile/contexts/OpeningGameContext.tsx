import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from 'react';
import { useFocusEffect } from 'expo-router';
import type { Move } from 'chess.js';
import { gameStateAnnouncement, verbalMove } from '@/lib/chessParser';
import { createOpponentEngine } from '@/lib/engines';
import { MIN_UCI_ELO } from '@/lib/engines/stockfish/uci';
import {
  DEFAULT_STRENGTH_BAND_ID,
  eloForBand,
  getStrengthBand,
} from '@/lib/difficulty/StockfishStrengthBands';
import { OpeningOpponent, type TheoryExit, type OpeningTrainingState, type OpeningPhase } from '@/lib/moves/OpeningOpponent';
import type { ParsedRepertoire } from '@/lib/repertoire';
import { movesForPosition } from '@/lib/repertoire';
import {
  anyChessPgnFilename,
  downloadPgnFile,
  exportGamePgn,
  resultFromGame,
} from '@/lib/pgn/PgnExporter';
import { identifyOpeningFromSans, getOpeningDisplayName } from '@/lib/openings';
import { speechService } from '@/services/SpeechService';
import {
  shouldEmitMoveRecognizedFeedback,
  type MoveInputSource,
} from '@/lib/moveInput/canonicalMove';
import {
  applyUserMoveInput,
  legalDestinationsForSquare,
  speakMoveHistorySummary,
  undoPlayerTurn,
  type BoardPiece,
  type LastMove,
  type MoveEvent,
  type PlayerColor,
} from '@/lib/game';
import { tMsg } from '@/lib/i18n';
import { useSharedPlayState } from '@/hooks/useSharedPlayState';

export type { BoardPiece, LastMove, MoveEvent, PlayerColor };

interface OpeningGameContextValue {
  board: (BoardPiece | null)[][];
  history: string[];
  status: string;
  heardText: string;
  lastMove: LastMove | null;
  isGameOver: boolean;
  waitingForUser: boolean;
  isOpponentThinking: boolean;
  playerColor: PlayerColor;
  moveEvent: MoveEvent | null;
  isSpeaking: boolean;
  phase: OpeningPhase;
  trainingState: OpeningTrainingState;
  theoryExit: TheoryExit | null;
  repertoireName: string;
  openingLabel: string | null;
  strengthBandId: string;
  strengthBandLabel: string;
  ready: boolean;
  loadError: string | null;
  applyUserMove: (raw: string, source?: MoveInputSource) => void;
  movePieceBySquare: (from: string, to: string) => boolean;
  getLegalDestinations: (square: string) => string[];
  newGame: () => void;
  changeColor: (color: PlayerColor) => void;
  repeatLast: () => void;
  summarizeGame: () => void;
  undoMove: () => void;
  /** Keep current position and continue vs Stockfish. */
  continueVsEngine: () => void;
  /** Undo off-book move and return to theory without revealing. */
  undoAndThinkAgain: () => void;
  /** Undo off-book move, play/show the expected book move, continue theory. */
  showExpectedMove: () => string | null;
  /** Restart exact training from the initial position (same side/settings). */
  restartLine: () => void;
  /** Start another line (new game — different random book branches). */
  nextLine: () => void;
  exportPgn: () => string;
  downloadPgn: () => void;
}

const OpeningGameContext = createContext<OpeningGameContextValue | null>(null);

interface ProviderProps {
  children: React.ReactNode;
  repertoire: ParsedRepertoire | null;
  repertoireName: string;
  loadError?: string | null;
  /** Stockfish strength band after leaving book. */
  strengthBandId?: string;
}

function engineOptionsForBand(bandId: string) {
  const targetElo = eloForBand(getStrengthBand(bandId));
  if (targetElo < MIN_UCI_ELO) {
    return { elo: MIN_UCI_ELO, multiPv: 8, varietyMarginCp: 120 };
  }
  return { elo: targetElo };
}

export function OpeningGameProvider({
  children,
  repertoire,
  repertoireName,
  loadError = null,
  strengthBandId = DEFAULT_STRENGTH_BAND_ID,
}: ProviderProps) {
  const opponentRef = useRef<OpeningOpponent | null>(null);
  const [phase, setPhase] = React.useState<OpeningPhase>('book');
  const [trainingState, setTrainingState] =
    React.useState<OpeningTrainingState>('playingTheory');
  const [theoryExit, setTheoryExit] = React.useState<TheoryExit | null>(null);
  const [ready, setReady] = React.useState(false);
  const band = getStrengthBand(strengthBandId);
  const strengthBandLabel = band.label;

  const play = useSharedPlayState();
  const {
    gameRef,
    playerColorRef,
    moveGenerationRef,
    opponentMoveRef,
    playerColor,
    setPlayerColor,
    board,
    history,
    status,
    setStatus,
    heardText,
    setHeardText,
    lastMove,
    setLastMove,
    isGameOver,
    waitingForUser,
    setWaitingForUser,
    isOpponentThinking,
    setIsOpponentThinking,
    moveEvent,
    isSpeaking,
    syncState,
    speak,
    emitEvent,
    repeatLast,
    cancelPendingOpponent,
    resetUiForNewGame,
    scheduleOpponentKickoff,
  } = play;

  useFocusEffect(
    useCallback(() => {
      if (!repertoire) {
        setReady(false);
        return () => {};
      }

      const engine = createOpponentEngine(engineOptionsForBand(strengthBandId));
      const opponent = new OpeningOpponent(repertoire, engine);
      opponentRef.current = opponent;
      setReady(false);

      let cancelled = false;
      opponent
        .init()
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setReady(true);
        });

      return () => {
        cancelled = true;
        // Invalidate in-flight opponentMove callbacks (mirrors Classic GameContext).
        cancelPendingOpponent(() => opponent.cancel());
        opponent.destroy();
        if (opponentRef.current === opponent) opponentRef.current = null;
        setReady(false);
      };
    }, [repertoire, strengthBandId, cancelPendingOpponent]),
  );

  const syncTheoryUi = useCallback(() => {
    const opp = opponentRef.current;
    setPhase(opp?.getPhase() ?? 'book');
    setTrainingState(opp?.getTrainingState() ?? 'playingTheory');
    setTheoryExit(opp?.getTheoryExit() ?? null);
  }, []);

  const openingLabel = React.useMemo(() => {
    const eco = identifyOpeningFromSans(history);
    return getOpeningDisplayName({
      headersList: repertoire?.headers ?? null,
      ecoName: eco?.name ?? null,
    });
  }, [history, repertoire]);

  const summarizeGameHistory = useCallback(() => {
    const moves = gameRef.current.history();
    if (!moves.length) {
      speak(tMsg('game.emptyHistory'), { flush: true });
      return;
    }
    speechService.cancel('summarize');
    const exit = opponentRef.current?.getTheoryExit() ?? theoryExit;
    if (exit?.kind === 'player-deviation') {
      speechService.speak(tMsg('openings.theoryReport', { message: exit.message }));
    } else if (exit?.kind === 'repertoire-end') {
      speechService.speak(tMsg('openings.theoryReportComplete'));
    }
    speakMoveHistorySummary(moves, { skipCancel: true });
  }, [gameRef, speak, theoryExit]);

  const cancelPending = useCallback(() => {
    cancelPendingOpponent(() => opponentRef.current?.cancel());
  }, [cancelPendingOpponent]);

  const opponentMove = useCallback(async () => {
    const game = gameRef.current;
    if (game.isGameOver()) return;

    const myGen = moveGenerationRef.current;
    setIsOpponentThinking(true);

    let selected: Move | null = null;
    let theoryMessage: string | null = null;
    try {
      const result = await opponentRef.current?.pickMove(game);
      selected = result?.move ?? null;
      theoryMessage = result?.theoryMessage ?? null;
    } catch {
      selected = null;
    }

    if (myGen !== moveGenerationRef.current) return;

    syncTheoryUi();

    if (theoryMessage) {
      speak(theoryMessage);
      setStatus(theoryMessage);
    }

    if (!selected) {
      setIsOpponentThinking(false);
      // lineComplete / outOfTheory: wait for decision buttons, not a user move.
      const st = opponentRef.current?.getTrainingState() ?? 'playingTheory';
      setWaitingForUser(st === 'playingTheory' || st === 'engineContinuation');
      return;
    }

    try {
      const played = game.move({
        from: selected.from,
        to: selected.to,
        promotion: selected.promotion || 'q',
      }) as Move;

      setLastMove({ from: played.from, to: played.to });
      syncState();

      const announcement = gameStateAnnouncement(game, verbalMove(played));
      setIsOpponentThinking(false);
      setWaitingForUser(!game.isGameOver());
      setStatus(announcement);
      speak(announcement);
    } catch {
      setIsOpponentThinking(false);
      setWaitingForUser(true);
    }
  }, [
    gameRef,
    moveGenerationRef,
    setIsOpponentThinking,
    syncTheoryUi,
    speak,
    setStatus,
    setWaitingForUser,
    setLastMove,
    syncState,
  ]);

  opponentMoveRef.current = opponentMove;

  const finishPlayerMove = useCallback(
    (played: Move, beforeFen: string, source: MoveInputSource) => {
      setLastMove({ from: played.from, to: played.to });
      setHeardText('');
      syncState();
      if (shouldEmitMoveRecognizedFeedback(source)) {
        emitEvent('success', source);
      }

      const game = gameRef.current;
      const plyAfter = game.history().length;
      const theoryMsg = opponentRef.current?.onPlayerMove(beforeFen, played, plyAfter) ?? null;
      syncTheoryUi();

      const playerAnnouncement = gameStateAnnouncement(game, verbalMove(played));
      speechService.cancel('move');

      if (theoryMsg) {
        // Left theory — pause; do not call the engine until the user chooses.
        speak(playerAnnouncement);
        speak(theoryMsg);
        setStatus(theoryMsg);
        setWaitingForUser(false);
        setIsOpponentThinking(false);
        return;
      }

      speak(playerAnnouncement);
      setStatus(playerAnnouncement);

      if (game.isGameOver()) {
        setWaitingForUser(false);
      } else {
        setWaitingForUser(false);
        opponentMoveRef.current();
      }
    },
    [
      setLastMove,
      setHeardText,
      syncState,
      emitEvent,
      gameRef,
      syncTheoryUi,
      speak,
      setStatus,
      setWaitingForUser,
      setIsOpponentThinking,
      opponentMoveRef,
    ],
  );

  const undoMove = useCallback(() => {
    cancelPending();
    speechService.cancel('undo');

    const result = undoPlayerTurn(gameRef.current, playerColorRef.current);
    if (result.kind === 'noop') return;

    if (result.kind === 'undone-to-start') {
      opponentRef.current?.onUndo(0);
      syncTheoryUi();
      syncState();
      setLastMove(null);
      setWaitingForUser(true);
      setIsOpponentThinking(false);
      setHeardText('');
      setStatus(result.status);
      speak(result.speak);
      return;
    }

    opponentRef.current?.onUndo(result.plyAfter);
    syncTheoryUi();
    syncState();
    setIsOpponentThinking(false);
    setHeardText('');
    setWaitingForUser(true);
    setLastMove(result.lastMove);
    setStatus(result.status);
    speak(result.speak);
  }, [
    cancelPending,
    gameRef,
    playerColorRef,
    syncTheoryUi,
    syncState,
    setLastMove,
    setWaitingForUser,
    setIsOpponentThinking,
    setHeardText,
    setStatus,
    speak,
  ]);

  const applyUserMove = useCallback(
    (raw: string, source: MoveInputSource = 'voice') => {
      const result = applyUserMoveInput({
        raw,
        game: gameRef.current,
        mode: 'opening',
        waitingForUser,
        isOpponentThinking,
        source,
      });

      if (result.kind === 'command') {
        if (result.command === 'repeat') repeatLast();
        else if (result.command === 'summarize') summarizeGameHistory();
        else if (result.command === 'undo') undoMove();
        return;
      }

      speechService.cancel('move');
      if (result.kind === 'ignored-busy') return;

      setHeardText(result.heardText);

      if (result.kind === 'unrecognized') {
        setStatus(tMsg('game.unrecognized'));
        if (result.emitError) emitEvent('error', source);
        return;
      }
      if (result.kind === 'ambiguous') {
        setStatus(tMsg('game.ambiguous'));
        emitEvent('error', source);
        return;
      }
      if (result.kind === 'illegal') {
        setStatus(tMsg('game.illegal'));
        emitEvent('error', source);
        return;
      }

      finishPlayerMove(result.played, result.beforeFen, source);
    },
    [
      gameRef,
      waitingForUser,
      isOpponentThinking,
      repeatLast,
      summarizeGameHistory,
      undoMove,
      setHeardText,
      setStatus,
      emitEvent,
      finishPlayerMove,
    ],
  );

  const movePieceBySquare = useCallback(
    (from: string, to: string): boolean => {
      const game = gameRef.current;
      if (!waitingForUser || isOpponentThinking || game.isGameOver()) return false;
      const beforeFen = game.fen();
      try {
        const played = game.move({ from, to, promotion: 'q' }) as Move;
        finishPlayerMove(played, beforeFen, 'touch');
        return true;
      } catch {
        return false;
      }
    },
    [gameRef, waitingForUser, isOpponentThinking, finishPlayerMove],
  );

  const getLegalDestinations = useCallback(
    (square: string): string[] =>
      legalDestinationsForSquare(gameRef.current, square, playerColorRef.current, {
        waitingForUser,
      }),
    [gameRef, playerColorRef, waitingForUser],
  );

  const resetForColor = useCallback(
    (color: PlayerColor) => {
      cancelPending();
      opponentRef.current?.newGame();
      speechService.cancel('new-game');
      gameRef.current.reset();
      resetUiForNewGame();
      setPhase('book');
      setTrainingState('playingTheory');
      setTheoryExit(null);
      syncState();

      if (color === 'b') {
        setWaitingForUser(false);
        setStatus(tMsg('game.opponentPreparing'));
        scheduleOpponentKickoff(1200);
      } else {
        setWaitingForUser(true);
        setStatus(tMsg('game.yourTurn'));
      }
    },
    [
      cancelPending,
      gameRef,
      resetUiForNewGame,
      syncState,
      setWaitingForUser,
      setStatus,
      scheduleOpponentKickoff,
    ],
  );

  const newGame = useCallback(() => {
    resetForColor(playerColorRef.current);
  }, [resetForColor, playerColorRef]);

  const restartLine = useCallback(() => {
    resetForColor(playerColorRef.current);
  }, [resetForColor, playerColorRef]);

  const nextLine = useCallback(() => {
    // Same side/settings; newGame re-rolls random book branches.
    resetForColor(playerColorRef.current);
  }, [resetForColor, playerColorRef]);

  const continueVsEngine = useCallback(() => {
    const opp = opponentRef.current;
    if (!opp) return;
    opp.continueVsEngine();
    syncTheoryUi();
    const game = gameRef.current;
    if (game.isGameOver()) {
      setWaitingForUser(false);
      setStatus(tMsg('openings.theoryCompleteContinuing'));
      return;
    }
    setStatus(tMsg('openings.theoryCompleteContinuing'));
    speak(tMsg('openings.theoryCompleteContinuing'));
    // If it's the opponent's turn after the user's off-book move (or line end),
    // kick Stockfish. If it's the user's turn, wait for them.
    const turn = game.turn();
    if (turn === playerColorRef.current) {
      setWaitingForUser(true);
      setIsOpponentThinking(false);
    } else {
      setWaitingForUser(false);
      opponentMoveRef.current();
    }
  }, [
    syncTheoryUi,
    gameRef,
    playerColorRef,
    setWaitingForUser,
    setIsOpponentThinking,
    setStatus,
    speak,
    opponentMoveRef,
  ]);

  const undoAndThinkAgain = useCallback(() => {
    const exit = opponentRef.current?.getTheoryExit();
    if (!exit || exit.kind !== 'player-deviation') return;
    cancelPending();
    speechService.cancel('undo');
    const result = undoPlayerTurn(gameRef.current, playerColorRef.current);
    if (result.kind === 'noop') return;
    opponentRef.current?.returnToTheory();
    syncTheoryUi();
    syncState();
    setIsOpponentThinking(false);
    setHeardText('');
    setWaitingForUser(true);
    setLastMove(result.kind === 'undone-to-start' ? null : result.lastMove);
    setStatus(tMsg('game.yourTurn'));
    speak(tMsg('game.yourTurn'));
  }, [
    cancelPending,
    gameRef,
    playerColorRef,
    syncTheoryUi,
    syncState,
    setIsOpponentThinking,
    setHeardText,
    setWaitingForUser,
    setLastMove,
    setStatus,
    speak,
  ]);

  const showExpectedMove = useCallback((): string | null => {
    const opp = opponentRef.current;
    const exit = opp?.getTheoryExit();
    if (!opp || !exit || exit.kind !== 'player-deviation') return null;
    const expected = exit.analysis?.availableMoves[0];
    if (!expected) return null;

    cancelPending();
    speechService.cancel('hint');

    // Undo the off-book move first.
    const undoResult = undoPlayerTurn(gameRef.current, playerColorRef.current);
    if (undoResult.kind === 'noop') return null;

    opp.returnToTheory();
    const game = gameRef.current;
    const beforeFen = game.fen();
    const choices = movesForPosition(opp.getRepertoire(), beforeFen);
    const choice = choices.find((c) => c.uci === expected.uci) ?? choices[0];
    if (!choice) {
      syncTheoryUi();
      syncState();
      setWaitingForUser(true);
      setStatus(tMsg('game.yourTurn'));
      return null;
    }

    try {
      const played = game.move({
        from: choice.from,
        to: choice.to,
        promotion: choice.promotion || 'q',
      }) as Move;
      setLastMove({ from: played.from, to: played.to });
      syncTheoryUi();
      syncState();
      const expectedLabel = expected.san;
      setStatus(tMsg('openings.expectedMove', { move: expectedLabel }));
      speak(tMsg('openings.expectedMove', { move: verbalMove(played) }));
      setHeardText('');
      setIsOpponentThinking(false);
      if (game.isGameOver()) {
        setWaitingForUser(false);
      } else {
        setWaitingForUser(false);
        opponentMoveRef.current();
      }
      return expectedLabel;
    } catch {
      syncTheoryUi();
      syncState();
      setWaitingForUser(true);
      setStatus(tMsg('game.yourTurn'));
      return null;
    }
  }, [
    cancelPending,
    gameRef,
    playerColorRef,
    syncTheoryUi,
    syncState,
    setLastMove,
    setStatus,
    speak,
    setHeardText,
    setIsOpponentThinking,
    setWaitingForUser,
    opponentMoveRef,
  ]);

  const changeColor = useCallback(
    (color: PlayerColor) => {
      playerColorRef.current = color;
      setPlayerColor(color);
      resetForColor(color);
    },
    [playerColorRef, setPlayerColor, resetForColor],
  );

  const buildPgn = useCallback(() => {
    const game = gameRef.current;
    const moves = game.history({ verbose: true }) as Move[];
    const opening = identifyOpeningFromSans(game.history());
    const exit = opponentRef.current?.getTheoryExit() ?? null;
    const result = resultFromGame({
      isGameOver: game.isGameOver(),
      isCheckmate: game.isCheckmate(),
      turn: game.turn(),
      isDraw: game.isDraw(),
    });

    const whiteName = playerColorRef.current === 'w' ? 'Joueur' : repertoireName;
    const blackName = playerColorRef.current === 'b' ? 'Joueur' : repertoireName;

    return exportGamePgn({
      headers: {
        Event: tMsg('openings.pgnEvent'),
        White: whiteName,
        Black: blackName,
        Result: result,
        Opening: opening?.name ?? repertoireName,
        Eco: opening?.eco,
        Repertoire: repertoireName,
      },
      moves,
      commentAfterPly: exit ? { ply: exit.ply, text: exit.pgnComment } : undefined,
    });
  }, [gameRef, playerColorRef, repertoireName]);

  const exportPgn = useCallback(() => buildPgn(), [buildPgn]);
  const downloadPgn = useCallback(() => {
    downloadPgnFile(anyChessPgnFilename(), buildPgn());
  }, [buildPgn]);

  useEffect(() => {
    if (ready && repertoire) {
      resetForColor(playerColorRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, repertoire]);

  return (
    <OpeningGameContext.Provider
      value={{
        board,
        history,
        status,
        heardText,
        lastMove,
        isGameOver,
        waitingForUser,
        isOpponentThinking,
        playerColor,
        moveEvent,
        isSpeaking,
        phase,
        trainingState,
        theoryExit,
        repertoireName,
        openingLabel,
        strengthBandId,
        strengthBandLabel,
        ready,
        loadError,
        applyUserMove,
        movePieceBySquare,
        getLegalDestinations,
        newGame,
        changeColor,
        repeatLast,
        summarizeGame: summarizeGameHistory,
        undoMove,
        continueVsEngine,
        undoAndThinkAgain,
        showExpectedMove,
        restartLine,
        nextLine,
        exportPgn,
        downloadPgn,
      }}
    >
      {children}
    </OpeningGameContext.Provider>
  );
}

export function useOpeningGame(): OpeningGameContextValue {
  const ctx = useContext(OpeningGameContext);
  if (!ctx) throw new Error('useOpeningGame must be used within OpeningGameProvider');
  return ctx;
}
