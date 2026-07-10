import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { Chess } from 'chess.js';
import type { Move, Square } from 'chess.js';
import * as Speech from 'expo-speech';
import {
  gameStateAnnouncement,
  parseSpoken,
  pickOpponentMove,
  verbalMove,
} from '@/lib/chessParser';

// ── Types ──────────────────────────────────────────────────────────────────

export type PlayerColor = 'w' | 'b';

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
  playerColor: PlayerColor;
  applyUserMove: (raw: string) => void;
  movePieceBySquare: (from: string, to: string) => boolean;
  getLegalDestinations: (square: string) => string[];
  newGame: () => void;
  changeColor: (color: PlayerColor) => void;
  repeatLast: () => void;
}

// ── Context ────────────────────────────────────────────────────────────────

const GameContext = createContext<GameContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function GameProvider({ children }: { children: React.ReactNode }) {
  const gameRef = useRef(new Chess());
  const lastSpokenRef = useRef('');
  const playerColorRef = useRef<PlayerColor>('w');

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

  // ── opponentMove ─────────────────────────────────────────────────────────
  // Kept in a ref so applyUserMove / movePieceBySquare avoid circular deps.

  const opponentMoveRef = useRef<() => void>(() => {});
  const opponentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const opponentMove = useCallback(() => {
    const game = gameRef.current;
    if (game.isGameOver()) return;

    setIsOpponentThinking(true);

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
    }, 2000); // 2-second thinking delay
  }, [syncState, speak]);

  opponentMoveRef.current = opponentMove;

  // ── Shared post-move logic ────────────────────────────────────────────────

  const finishPlayerMove = useCallback(
    (played: Move) => {
      setLastMove({ from: played.from, to: played.to });
      setHeardText('');
      syncState();

      const game = gameRef.current;
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
    },
    [syncState, speak],
  );

  // ── applyUserMove (voice / text input) ────────────────────────────────────

  const applyUserMove = useCallback(
    (raw: string) => {
      const game = gameRef.current;
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
        const played = game.move({
          from: parsed.move.from,
          to: parsed.move.to,
          promotion: 'q',
        }) as Move;
        finishPlayerMove(played);
      } catch {
        const msg = 'Ce coup est illégal. Répète.';
        setStatus(msg);
        speak(msg);
      }
    },
    [waitingForUser, isOpponentThinking, speak, finishPlayerMove],
  );

  // ── movePieceBySquare (touch input) ───────────────────────────────────────

  const movePieceBySquare = useCallback(
    (from: string, to: string): boolean => {
      const game = gameRef.current;
      if (!waitingForUser || isOpponentThinking || game.isGameOver()) return false;
      try {
        const played = game.move({ from, to, promotion: 'q' }) as Move;
        finishPlayerMove(played);
        return true;
      } catch {
        return false;
      }
    },
    [waitingForUser, isOpponentThinking, finishPlayerMove],
  );

  // ── getLegalDestinations ──────────────────────────────────────────────────

  const getLegalDestinations = useCallback(
    (square: string): string[] => {
      const game = gameRef.current;
      if (!waitingForUser || game.isGameOver()) return [];
      const piece = game.get(square as Square);
      if (!piece || piece.color !== playerColorRef.current) return [];
      try {
        const moves = game.moves({
          verbose: true,
          square: square as Square,
        }) as Move[];
        return [...new Set(moves.map(m => m.to))];
      } catch {
        return [];
      }
    },
    [waitingForUser],
  );

  // ── Reset / new game ──────────────────────────────────────────────────────

  const resetForColor = useCallback(
    (color: PlayerColor) => {
      if (opponentTimeoutRef.current != null) {
        clearTimeout(opponentTimeoutRef.current);
        opponentTimeoutRef.current = null;
      }
      try { Speech.stop(); } catch { /* ignore */ }
      gameRef.current.reset();
      lastSpokenRef.current = '';
      setLastMove(null);
      setHeardText('');
      setIsGameOver(false);
      setIsOpponentThinking(false);
      syncState();

      if (color === 'b') {
        // User plays Black — AI goes first as White
        setWaitingForUser(false);
        setStatus("L'adversaire prépare son coup…");
        opponentTimeoutRef.current = setTimeout(() => {
          opponentTimeoutRef.current = null;
          opponentMoveRef.current();
        }, 2000);
      } else {
        setWaitingForUser(true);
        setStatus('À toi de jouer.');
      }
    },
    [syncState],
  );

  const newGame = useCallback(() => {
    resetForColor(playerColorRef.current);
  }, [resetForColor]);

  const changeColor = useCallback(
    (color: PlayerColor) => {
      playerColorRef.current = color;
      setPlayerColor(color);
      resetForColor(color);
    },
    [resetForColor],
  );

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
        applyUserMove,
        movePieceBySquare,
        getLegalDestinations,
        newGame,
        changeColor,
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
