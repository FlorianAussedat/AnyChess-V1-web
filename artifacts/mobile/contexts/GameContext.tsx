import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { useFocusEffect } from 'expo-router';
import type { Move } from 'chess.js';
import { gameStateAnnouncement, verbalMove } from '@/lib/chessParser';
import type { ChessEngine } from '@/lib/engine';
import { createOpponentEngine } from '@/lib/engines';
import { MIN_UCI_ELO } from '@/lib/engines/stockfish/uci';
import {
  shouldEmitMoveRecognizedFeedback,
  type MoveInputSource,
} from '@/lib/moveInput/canonicalMove';
import {
  DEFAULT_STRENGTH_BAND_ID,
  eloForBand,
  getStrengthBand,
} from '@/lib/difficulty/StockfishStrengthBands';
import { speechService } from '@/services/SpeechService';
import {
  anyChessPgnFilename,
  downloadPgnFile,
  exportGamePgn,
  resultFromGame,
} from '@/lib/pgn/PgnExporter';
import { identifyOpeningFromSans } from '@/lib/openings';
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
import { preferencesStore } from '@/lib/preferences';

export type { BoardPiece, LastMove, MoveEvent, PlayerColor };

interface GameContextValue {
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
  strengthBandId: string;
  setStrengthBandId: (id: string) => void;
  /** Returns true only when a legal move was played. */
  applyUserMove: (raw: string, source?: MoveInputSource) => boolean;
  movePieceBySquare: (from: string, to: string) => boolean;
  getLegalDestinations: (square: string) => string[];
  newGame: () => void;
  changeColor: (color: PlayerColor) => void;
  repeatLast: () => void;
  summarizeGame: () => void;
  undoMove: () => void;
  /** Re-kick opponent search after a failed engine move. */
  retryOpponentMove: () => void;
  exportPgn: () => string;
  downloadPgn: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const initialBand =
    preferencesStore.getPreferences().stockfishStrengthBandId ||
    DEFAULT_STRENGTH_BAND_ID;
  const strengthBandIdRef = useRef(initialBand);
  const engineRef = useRef<ChessEngine | null>(null);
  const [strengthBandId, setStrengthBandIdState] = useState(initialBand);

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

  const engineOptionsForBand = useCallback((bandId: string) => {
    const targetElo = eloForBand(getStrengthBand(bandId));
    if (targetElo < MIN_UCI_ELO) {
      return { elo: MIN_UCI_ELO, multiPv: 8, varietyMarginCp: 120 };
    }
    return { elo: targetElo };
  }, []);

  const recreateEngine = useCallback(
    (bandId: string) => {
      const prev = engineRef.current;
      prev?.cancel?.();
      prev?.destroy?.();
      const next = createOpponentEngine(engineOptionsForBand(bandId));
      engineRef.current = next;
      next.init?.().catch(() => {});
    },
    [engineOptionsForBand],
  );

  useFocusEffect(
    useCallback(() => {
      if (!engineRef.current) {
        engineRef.current = createOpponentEngine(
          engineOptionsForBand(strengthBandIdRef.current),
        );
      }
      engineRef.current.init?.().catch(() => {});
      return () => {
        moveGenerationRef.current += 1;
        const engine = engineRef.current;
        engineRef.current = null;
        engine?.cancel?.();
        engine?.destroy?.();
      };
    }, [engineOptionsForBand, moveGenerationRef]),
  );

  const setStrengthBandId = useCallback(
    (id: string) => {
      const normalized = getStrengthBand(id).id;
      strengthBandIdRef.current = normalized;
      setStrengthBandIdState(normalized);
      recreateEngine(normalized);
      void preferencesStore.update({ stockfishStrengthBandId: normalized });
    },
    [recreateEngine],
  );

  const summarizeGameHistory = useCallback(() => {
    speakMoveHistorySummary(gameRef.current.history());
  }, [gameRef]);

  const cancelPending = useCallback(() => {
    cancelPendingOpponent(() => engineRef.current?.cancel?.());
  }, [cancelPendingOpponent]);

  const opponentMove = useCallback(async () => {
    const game = gameRef.current;
    if (game.isGameOver()) return;

    const myGen = moveGenerationRef.current;
    setIsOpponentThinking(true);

    let selected: Move | null = null;
    try {
      selected = (await engineRef.current?.pickMove(game)) ?? null;
    } catch {
      selected = null;
    }

    if (myGen !== moveGenerationRef.current) {
      setIsOpponentThinking(false);
      return;
    }

    if (!selected) {
      setIsOpponentThinking(false);
      setWaitingForUser(true);
      setStatus(tMsg('game.opponentFailed'));
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
    setWaitingForUser,
    setLastMove,
    syncState,
    setStatus,
    speak,
  ]);

  opponentMoveRef.current = opponentMove;

  const finishPlayerMove = useCallback(
    (played: Move, source: MoveInputSource) => {
      setLastMove({ from: played.from, to: played.to });
      setHeardText('');
      syncState();
      if (shouldEmitMoveRecognizedFeedback(source)) {
        emitEvent('success', source);
      }

      const game = gameRef.current;
      const playerAnnouncement = gameStateAnnouncement(game, verbalMove(played));
      speechService.cancel('move');

      if (game.isGameOver()) {
        setWaitingForUser(false);
        setStatus(playerAnnouncement);
        speak(playerAnnouncement);
      } else {
        setStatus(playerAnnouncement);
        speak(playerAnnouncement);
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
      setWaitingForUser,
      setStatus,
      speak,
      opponentMoveRef,
    ],
  );

  const undoMove = useCallback(() => {
    cancelPending();
    speechService.cancel('undo');

    const result = undoPlayerTurn(gameRef.current, playerColorRef.current);
    if (result.kind === 'noop') return;

    syncState();
    setHeardText('');

    const kickoff = () => {
      if (result.needsOpponentKickoff) {
        setWaitingForUser(false);
        setIsOpponentThinking(false);
        opponentMoveRef.current();
      } else {
        setIsOpponentThinking(false);
        setWaitingForUser(true);
      }
    };

    if (result.kind === 'undone-to-start') {
      setLastMove(null);
      setStatus(result.status);
      speak(result.speak);
      kickoff();
      return;
    }

    setLastMove(result.lastMove);
    setStatus(result.status);
    speak(result.speak);
    kickoff();
  }, [
    cancelPending,
    gameRef,
    playerColorRef,
    syncState,
    setIsOpponentThinking,
    setHeardText,
    setWaitingForUser,
    setLastMove,
    setStatus,
    speak,
    opponentMoveRef,
  ]);

  const applyUserMove = useCallback(
    (raw: string, source: MoveInputSource = 'voice'): boolean => {
      const result = applyUserMoveInput({
        raw,
        game: gameRef.current,
        mode: 'classic',
        waitingForUser,
        isOpponentThinking,
        source,
      });

      if (result.kind === 'command') {
        if (result.command === 'repeat') repeatLast();
        else if (result.command === 'summarize') summarizeGameHistory();
        else if (result.command === 'undo') undoMove();
        return false;
      }

      speechService.cancel('move');
      if (result.kind === 'ignored-busy') return false;

      setHeardText(result.heardText);

      if (result.kind === 'unrecognized') {
        setStatus(tMsg('game.unrecognized'));
        if (result.emitError) emitEvent('error', source);
        return false;
      }
      if (result.kind === 'ambiguous') {
        setStatus(tMsg('game.ambiguous'));
        emitEvent('error', source);
        return false;
      }
      if (result.kind === 'illegal') {
        setStatus(tMsg('game.illegal'));
        emitEvent('error', source);
        return false;
      }

      finishPlayerMove(result.played, source);
      return true;
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
      try {
        const played = game.move({ from, to, promotion: 'q' }) as Move;
        finishPlayerMove(played, 'touch');
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
      speechService.cancel('new-game');
      recreateEngine(strengthBandIdRef.current);
      gameRef.current.reset();
      resetUiForNewGame();
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
      recreateEngine,
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
    const sans = game.history();
    const opening = identifyOpeningFromSans(sans);
    const result = resultFromGame({
      isGameOver: game.isGameOver(),
      isCheckmate: game.isCheckmate(),
      turn: game.turn(),
      isDraw: game.isDraw(),
    });

    const whiteName = playerColorRef.current === 'w' ? 'Joueur' : 'Stockfish';
    const blackName = playerColorRef.current === 'b' ? 'Joueur' : 'Stockfish';

    return exportGamePgn({
      headers: {
        Event: 'AnyChess — Classique',
        White: whiteName,
        Black: blackName,
        Result: result,
        Opening: opening?.name,
        Eco: opening?.eco,
      },
      moves,
    });
  }, [gameRef, playerColorRef]);

  const exportPgn = useCallback(() => buildPgn(), [buildPgn]);
  const downloadPgn = useCallback(() => {
    downloadPgnFile(anyChessPgnFilename(), buildPgn());
  }, [buildPgn]);

  const retryOpponentMove = useCallback(() => {
    if (gameRef.current.isGameOver()) return;
    setWaitingForUser(false);
    opponentMoveRef.current();
  }, [gameRef, setWaitingForUser, opponentMoveRef]);

  return (
    <GameContext.Provider
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
        strengthBandId,
        setStrengthBandId,
        applyUserMove,
        movePieceBySquare,
        getLegalDestinations,
        newGame,
        changeColor,
        repeatLast,
        summarizeGame: summarizeGameHistory,
        undoMove,
        retryOpponentMove,
        exportPgn,
        downloadPgn,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
