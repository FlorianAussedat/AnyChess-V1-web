import { useCallback, useEffect, useRef, useState } from 'react';
import { speechService } from '@/services/SpeechService';
import type { BoardPiece, LastMove, MoveEvent, PlayerColor } from '@/lib/game/types';
import type { MoveInputSource } from '@/lib/moveInput/canonicalMove';
import { Chess } from 'chess.js';

/**
 * Shared board / turn / speech state used by Classic and Openings providers.
 * Opponent orchestration stays mode-specific.
 */
export function useSharedPlayState() {
  const gameRef = useRef(new Chess());
  const lastSpokenRef = useRef('');
  const playerColorRef = useRef<PlayerColor>('w');
  const moveGenerationRef = useRef(0);
  const opponentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opponentMoveRef = useRef<() => void>(() => {});

  const [playerColor, setPlayerColor] = useState<PlayerColor>('w');
  const [board, setBoard] = useState<(BoardPiece | null)[][]>(
    () => gameRef.current.board() as (BoardPiece | null)[][],
  );
  const [history, setHistory] = useState<string[]>([]);
  const [status, setStatus] = useState('À toi de jouer.');
  const [heardText, setHeardText] = useState('');
  const [lastMove, setLastMove] = useState<LastMove | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [waitingForUser, setWaitingForUser] = useState(true);
  const [isOpponentThinking, setIsOpponentThinking] = useState(false);
  const [moveEvent, setMoveEvent] = useState<MoveEvent | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    const unsubscribe = speechService.onSpeakingChange(setIsSpeaking);
    return () => {
      unsubscribe();
      speechService.cancel('unmount');
    };
  }, []);

  const syncState = useCallback(() => {
    const g = gameRef.current;
    setBoard(g.board() as (BoardPiece | null)[][]);
    setHistory(g.history());
    setIsGameOver(g.isGameOver());
  }, []);

  const speak = useCallback((text: string, opts?: { flush?: boolean }) => {
    lastSpokenRef.current = text;
    speechService.speak(text, opts);
  }, []);

  const emitEvent = useCallback((kind: 'success' | 'error', source?: MoveInputSource) => {
    setMoveEvent((prev) => ({ kind, id: (prev?.id ?? 0) + 1, source }));
  }, []);

  const repeatLast = useCallback(() => {
    speak(lastSpokenRef.current || 'Aucun coup à répéter.', { flush: true });
  }, [speak]);

  const cancelPendingOpponent = useCallback((cancelEngine?: () => void) => {
    moveGenerationRef.current += 1;
    if (opponentTimeoutRef.current != null) {
      clearTimeout(opponentTimeoutRef.current);
      opponentTimeoutRef.current = null;
    }
    cancelEngine?.();
  }, []);

  const resetUiForNewGame = useCallback(() => {
    lastSpokenRef.current = '';
    setLastMove(null);
    setHeardText('');
    setIsGameOver(false);
    setIsOpponentThinking(false);
    setMoveEvent(null);
    setIsSpeaking(false);
  }, []);

  const scheduleOpponentKickoff = useCallback((delayMs = 1200) => {
    opponentTimeoutRef.current = setTimeout(() => {
      opponentTimeoutRef.current = null;
      opponentMoveRef.current();
    }, delayMs);
  }, []);

  return {
    gameRef,
    lastSpokenRef,
    playerColorRef,
    moveGenerationRef,
    opponentTimeoutRef,
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
  };
}
