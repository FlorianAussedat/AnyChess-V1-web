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
import { OpeningOpponent, type TheoryExit } from '@/lib/moves/OpeningOpponent';
import type { ParsedRepertoire } from '@/lib/repertoire';
import {
  anyChessPgnFilename,
  downloadPgnFile,
  exportGamePgn,
  resultFromGame,
} from '@/lib/pgn/PgnExporter';
import { identifyOpeningFromSans } from '@/lib/openings';
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
  phase: 'book' | 'engine';
  theoryExit: TheoryExit | null;
  repertoireName: string;
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
  const [phase, setPhase] = React.useState<'book' | 'engine'>('book');
  const [theoryExit, setTheoryExit] = React.useState<TheoryExit | null>(null);
  const [ready, setReady] = React.useState(false);

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
        opponent.cancel();
        opponent.destroy();
        if (opponentRef.current === opponent) opponentRef.current = null;
        setReady(false);
      };
    }, [repertoire, strengthBandId]),
  );

  const syncTheoryUi = useCallback(() => {
    const opp = opponentRef.current;
    setPhase(opp?.getPhase() ?? 'book');
    setTheoryExit(opp?.getTheoryExit() ?? null);
  }, []);

  const summarizeGameHistory = useCallback(() => {
    const moves = gameRef.current.history();
    if (!moves.length) {
      speak('Aucun coup joué pour le moment.', { flush: true });
      return;
    }
    speechService.cancel('summarize');
    const exit = opponentRef.current?.getTheoryExit() ?? theoryExit;
    if (exit?.kind === 'player-deviation') {
      speechService.speak(`Rapport : ${exit.message}`);
    } else if (exit?.kind === 'repertoire-end') {
      speechService.speak('Rapport : ligne théorique importée suivie jusqu’à son terme.');
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
      setWaitingForUser(true);
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
        speak(playerAnnouncement);
        speak(theoryMsg);
        setStatus(theoryMsg);
      } else {
        speak(playerAnnouncement);
        setStatus(playerAnnouncement);
      }

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
        setStatus('Coup non reconnu. Répète.');
        if (result.emitError) emitEvent('error', source);
        return;
      }
      if (result.kind === 'ambiguous') {
        setStatus('Coup ambigu. Précise la case de départ.');
        emitEvent('error', source);
        return;
      }
      if (result.kind === 'illegal') {
        setStatus('Coup illégal. Répète.');
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
      setTheoryExit(null);
      syncState();

      if (color === 'b') {
        setWaitingForUser(false);
        setStatus("L'adversaire prépare son coup…");
        scheduleOpponentKickoff(1200);
      } else {
        setWaitingForUser(true);
        setStatus('À toi de jouer.');
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
        Event: 'AnyChess — Ouvertures',
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
        theoryExit,
        repertoireName,
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
