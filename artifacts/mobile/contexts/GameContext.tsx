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
  normalize,
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

/** Emitted after every user-move attempt so the UI can trigger haptics/sounds. */
export type MoveEvent = { kind: 'success' | 'error'; id: number };

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
  applyUserMove: (raw: string) => void;
  movePieceBySquare: (from: string, to: string) => boolean;
  getLegalDestinations: (square: string) => string[];
  newGame: () => void;
  changeColor: (color: PlayerColor) => void;
  repeatLast: () => void;
  summarizeGame: () => void;
}

// ── Context ────────────────────────────────────────────────────────────────

const GameContext = createContext<GameContextValue | null>(null);

// ── Chess-relevance heuristic ─────────────────────────────────────────────
// Only emit an error event when the input looks like a genuine move attempt.
// Prevents buzzing on random ambient noise or unrelated speech.

function looksLikeChessMove(normalized: string): boolean {
  if (/\b[a-h][1-8]\b/.test(normalized)) return true;
  if (/\b(pion|cavalier|fou|tour|dame|roi|pawn|knight|bishop|rook|queen|king|roque|castle|petit|grand)\b/.test(normalized)) return true;
  if (/\bprend|takes|captures\b/.test(normalized)) return true;
  return false;
}

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
  const [moveEvent, setMoveEvent] = useState<MoveEvent | null>(null);

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

  const emitEvent = useCallback((kind: 'success' | 'error') => {
    setMoveEvent(prev => ({ kind, id: (prev?.id ?? 0) + 1 }));
  }, []);

  const repeatLast = useCallback(() => {
    speak(lastSpokenRef.current || 'Aucun coup à répéter.');
  }, [speak]);

  // ── summarizeGameHistory ──────────────────────────────────────────────────

  const summarizeGameHistory = useCallback(() => {
    try { Speech.stop(); } catch { /* ignore */ }
    const moves = gameRef.current.history();
    if (!moves.length) {
      Speech.speak('Aucun coup joué pour le moment.', { language: 'fr-FR', rate: 0.9 });
      return;
    }
    const speakAt = (i: number) => {
      if (i >= moves.length) return;
      const pairNum = Math.floor(i / 2) + 1;
      const isWhite = i % 2 === 0;
      const text = isWhite ? `${pairNum}. ${moves[i]}` : moves[i];
      Speech.speak(text, {
        language: 'fr-FR',
        rate: 0.9,
        onDone: () => { setTimeout(() => speakAt(i + 1), 2000); },
      });
    };
    speakAt(0);
  }, []);

  // ── opponentMove ──────────────────────────────────────────────────────────

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
          setStatus(announcement);
          speak(announcement);
        }
      } catch {
        setIsOpponentThinking(false);
        setWaitingForUser(true);
      }
    }, 2000);
  }, [syncState, speak]);

  opponentMoveRef.current = opponentMove;

  // ── Shared post-move logic ────────────────────────────────────────────────

  const finishPlayerMove = useCallback(
    (played: Move) => {
      setLastMove({ from: played.from, to: played.to });
      setHeardText('');
      syncState();
      emitEvent('success');

      const game = gameRef.current;

      // Always speak the player's move aloud so they can confirm without
      // looking at the screen.
      const moveText = verbalMove(played);

      if (game.isGameOver()) {
        const endMsg = gameStateAnnouncement(game);
        setWaitingForUser(false);
        setStatus(moveText + ' — ' + endMsg);
        speak(moveText + '. ' + endMsg);
      } else if (game.isCheck()) {
        setStatus('Coup joué : ' + moveText + ' — Échec !');
        speak(moveText + '. Échec !');
        setWaitingForUser(false);
        opponentMoveRef.current();
      } else {
        setStatus('Coup joué : ' + moveText);
        speak(moveText);
        setWaitingForUser(false);
        opponentMoveRef.current();
      }
    },
    [syncState, speak, emitEvent],
  );

  // ── applyUserMove (voice / text input) ────────────────────────────────────

  const applyUserMove = useCallback(
    (raw: string) => {
      const input = normalize(raw);

      // ── Special commands — bypass turn guard ────────────────────────────
      if (/\brepete\b/.test(input)) { repeatLast(); return; }
      if (input.includes('resum'))  { summarizeGameHistory(); return; }

      const game = gameRef.current;
      if (!waitingForUser || isOpponentThinking || game.isGameOver()) return;

      setHeardText(raw ? `« ${raw} »` : '');
      const parsed = parseSpoken(raw, game);

      if (parsed.kind === 'unknown') {
        // No TTS for errors — avoids the mic picking up its own audio.
        // The status text + haptic is enough feedback.
        setStatus("Coup non reconnu. Répète.");
        if (looksLikeChessMove(input)) emitEvent('error');
        return;
      }
      if (parsed.kind === 'ambiguous') {
        setStatus("Coup ambigu. Répète plus précisément.");
        emitEvent('error');
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
        setStatus('Coup illégal. Répète.');
        emitEvent('error');
      }
    },
    [waitingForUser, isOpponentThinking, speak, finishPlayerMove,
     emitEvent, repeatLast, summarizeGameHistory],
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
        const moves = game.moves({ verbose: true, square: square as Square }) as Move[];
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
      setMoveEvent(null);
      syncState();

      if (color === 'b') {
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
        moveEvent,
        applyUserMove,
        movePieceBySquare,
        getLegalDestinations,
        newGame,
        changeColor,
        repeatLast,
        summarizeGame: summarizeGameHistory,
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
