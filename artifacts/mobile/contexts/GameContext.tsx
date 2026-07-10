import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import * as Speech from 'expo-speech';
import {
  gameStateAnnouncement,
  parseSpoken,
  pickOpponentMove,
  verbalMove,
} from '@/lib/chessParser';

// ── Types ──────────────────────────────────────────────────────────────────

export type BoardPiece = {
  square: string;
  type: string;
  color: 'w' | 'b';
};

export type LastMove = { from: string; to: string };

interface GameContextValue {
  board: (BoardPiece | null)[][];
  history: string[];
  status: string;
  heardText: string;
  lastMove: LastMove | null;
  isGameOver: boolean;
  waitingForUser: boolean;
  isOpponentThinking: boolean;
  applyUserMove: (raw: string) => void;
  newGame: () => void;
  repeatLast: () => void;
}

// ── Context ────────────────────────────────────────────────────────────────

const GameContext = createContext<GameContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function GameProvider({ children }: { children: React.ReactNode }) {
  const gameRef = useRef(new Chess());
  const lastSpokenRef = useRef('');

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

  // ── Helpers ──────────────────────────────────────────────────────────────

  const syncState = useCallback(() => {
    const g = gameRef.current;
    setBoard(g.board() as (BoardPiece | null)[][]);
    setHistory(g.history());
    setIsGameOver(g.isGameOver());
  }, []);

  const speak = useCallback((text: string) => {
    lastSpokenRef.current = text;
    try {
      Speech.speak(text, { language: 'fr-FR', rate: 0.95 });
    } catch { /* silently ignore TTS failures */ }
  }, []);

  const repeatLast = useCallback(() => {
    speak(lastSpokenRef.current || 'Aucun coup à répéter.');
  }, [speak]);

  // ── opponentMove kept in a ref so applyUserMove avoids circular deps ─────

  const opponentMoveRef = useRef<() => void>(() => {});
  const opponentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const opponentMove = useCallback(() => {
    const game = gameRef.current;
    if (game.isGameOver()) return;

    setIsOpponentThinking(true);

    // Cancel any already-pending AI move before scheduling a new one
    if (opponentTimeoutRef.current != null) {
      clearTimeout(opponentTimeoutRef.current);
    }

    opponentTimeoutRef.current = setTimeout(() => {
      opponentTimeoutRef.current = null;
      try {
        const selected = pickOpponentMove(game);
        if (!selected) {
          setIsOpponentThinking(false);
          setWaitingForUser(true);
          return;
        }

        const played = game.move({
          from: selected.from,
          to: selected.to,
          promotion: 'q',
        }) as Move;

        setLastMove({ from: played.from, to: played.to });
        syncState();

        let announcement = verbalMove(played);
        announcement = gameStateAnnouncement(game, announcement);
        setIsOpponentThinking(false);

        if (game.isGameOver()) {
          setWaitingForUser(false);
          setStatus(announcement);
          speak(announcement);
        } else {
          setWaitingForUser(true);
          setStatus(announcement + ' À toi.');
          speak(announcement);
        }
      } catch {
        setIsOpponentThinking(false);
        setWaitingForUser(true);
      }
    }, 650);
  }, [syncState, speak]);

  opponentMoveRef.current = opponentMove;

  // ── applyUserMove ─────────────────────────────────────────────────────────

  const applyUserMove = useCallback(
    (raw: string) => {
      const game = gameRef.current;
      // Strict turn guard — reject if it's not the player's turn
      if (!waitingForUser || isOpponentThinking || game.isGameOver()) return;

      setHeardText(raw ? `« ${raw} »` : '');
      const parsed = parseSpoken(raw, game);

      if (parsed.kind === 'unknown') {
        const msg = "Je n'ai pas compris le coup. Répète.";
        setStatus(msg);
        speak(msg);
        return;
      }
      if (parsed.kind === 'ambiguous') {
        const msg = "Je ne suis pas sûre d'avoir compris. Répète le coup.";
        setStatus(msg);
        speak(msg);
        return;
      }

      try {
        const chosen = parsed.move;
        const played = game.move({
          from: chosen.from,
          to: chosen.to,
          promotion: 'q',
        }) as Move;

        setLastMove({ from: played.from, to: played.to });
        syncState();

        const checkNote = game.isCheck() ? ' Échec.' : '';
        setStatus('Coup joué : ' + verbalMove(played) + checkNote);
        if (game.isCheck()) speak('Échec.');

        if (game.isGameOver()) {
          const endMsg = gameStateAnnouncement(game);
          setWaitingForUser(false);
          setStatus(endMsg);
          speak(endMsg);
        } else {
          setWaitingForUser(false);
          opponentMoveRef.current();
        }
      } catch {
        const msg = 'Ce coup est illégal. Répète.';
        setStatus(msg);
        speak(msg);
      }
    },
    [waitingForUser, isOpponentThinking, syncState, speak],
  );

  // ── newGame ───────────────────────────────────────────────────────────────

  const newGame = useCallback(() => {
    // Cancel any in-flight AI timeout so it cannot mutate the reset board
    if (opponentTimeoutRef.current != null) {
      clearTimeout(opponentTimeoutRef.current);
      opponentTimeoutRef.current = null;
    }
    try { Speech.stop(); } catch { /* ignore */ }
    gameRef.current.reset();
    lastSpokenRef.current = '';
    setLastMove(null);
    setHeardText('');
    setStatus('À toi de jouer.');
    setWaitingForUser(true);
    setIsOpponentThinking(false);
    syncState();
  }, [syncState]);

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
        applyUserMove,
        newGame,
        repeatLast,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
