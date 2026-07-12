import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
  sanToVerbal,
  verbalMove,
} from '@/lib/chessParser';
import type { ChessEngine } from '@/lib/engine';
import { createOpponentEngine } from '@/lib/engines';

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
  isSpeaking: boolean;
  applyUserMove: (raw: string) => void;
  movePieceBySquare: (from: string, to: string) => boolean;
  getLegalDestinations: (square: string) => string[];
  newGame: () => void;
  changeColor: (color: PlayerColor) => void;
  repeatLast: () => void;
  summarizeGame: () => void;
  undoMove: () => void;
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
  const gameRef         = useRef(new Chess());
  const lastSpokenRef   = useRef('');
  const playerColorRef  = useRef<PlayerColor>('w');

  // ── Opponent engine (Stockfish on web, built-in fallback on native) ─────────
  // We only ever talk to the ChessEngine interface — the concrete engine is
  // chosen by createOpponentEngine() and can be swapped without touching this
  // file. Created lazily once, warmed up on mount, torn down on unmount.
  const engineRef = useRef<ChessEngine | null>(null);
  if (engineRef.current === null) {
    engineRef.current = createOpponentEngine();
  }

  // Monotonic token that identifies the "current" engine turn. Bumping it
  // invalidates any in-flight engine computation (undo / new game / colour
  // change while the engine is thinking), so a late result is safely ignored.
  const moveGenerationRef = useRef(0);

  useEffect(() => {
    const engine = engineRef.current;
    engine?.init?.().catch(() => {
      /* engine failed to load — opponentMove will simply produce no move */
    });
    return () => { engine?.destroy?.(); };
  }, []);

  const [playerColor, setPlayerColor]           = useState<PlayerColor>('w');
  const [board, setBoard]                       = useState<(BoardPiece | null)[][]>(
    () => gameRef.current.board() as (BoardPiece | null)[][],
  );
  const [history, setHistory]                   = useState<string[]>([]);
  const [status, setStatus]                     = useState('À toi de jouer.');
  const [heardText, setHeardText]               = useState('');
  const [lastMove, setLastMove]                 = useState<LastMove | null>(null);
  const [isGameOver, setIsGameOver]             = useState(false);
  const [waitingForUser, setWaitingForUser]     = useState(true);
  const [isOpponentThinking, setIsOpponentThinking] = useState(false);
  const [moveEvent, setMoveEvent]               = useState<MoveEvent | null>(null);
  const [isSpeaking, setIsSpeaking]             = useState(false);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const syncState = useCallback(() => {
    const g = gameRef.current;
    setBoard(g.board() as (BoardPiece | null)[][]);
    setHistory(g.history());
    setIsGameOver(g.isGameOver());
  }, []);

  /**
   * Speak text via TTS.  Sets isSpeaking = true beforehand so the mic
   * layer (index.tsx) knows to pause listening.  The mic restarts once
   * onDone / onStopped / onError fires.
   */
  const speak = useCallback((text: string) => {
    lastSpokenRef.current = text;
    try {
      Speech.stop();
      setIsSpeaking(true);
      Speech.speak(text, {
        language: 'fr-FR',
        rate: 0.95,
        onDone:    () => setIsSpeaking(false),
        onStopped: () => setIsSpeaking(false),
        onError:   () => setIsSpeaking(false),
      });
    } catch {
      setIsSpeaking(false);
    }
  }, []);

  const emitEvent = useCallback((kind: 'success' | 'error') => {
    setMoveEvent(prev => ({ kind, id: (prev?.id ?? 0) + 1 }));
  }, []);

  const repeatLast = useCallback(() => {
    speak(lastSpokenRef.current || 'Aucun coup à répéter.');
  }, [speak]);

  // ── summarizeGame ─────────────────────────────────────────────────────────

  const summarizeGameHistory = useCallback(() => {
    try { Speech.stop(); } catch { /* ignore */ }
    const moves = gameRef.current.history();
    if (!moves.length) {
      speak('Aucun coup joué pour le moment.');
      return;
    }
    setIsSpeaking(true);
    const speakAt = (i: number) => {
      if (i >= moves.length) { setIsSpeaking(false); return; }
      const pairNum = Math.floor(i / 2) + 1;
      const isWhite = i % 2 === 0;
      const verbal = sanToVerbal(moves[i]);
      const text = isWhite ? `${pairNum}. ${verbal}` : verbal;
      Speech.speak(text, {
        language: 'fr-FR',
        rate: 0.9,
        onDone:    () => { setTimeout(() => speakAt(i + 1), 300); },
        onStopped: () => setIsSpeaking(false),
        onError:   () => setIsSpeaking(false),
      });
    };
    speakAt(0);
  }, [speak]);

  // ── opponentMove ──────────────────────────────────────────────────────────

  const opponentMoveRef     = useRef<() => void>(() => {});
  const opponentTimeoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Abort a pending/in-flight engine turn. Invalidates the current generation
   * (so a late engine result is discarded), clears any scheduled kickoff, and
   * tells the engine to stop calculating. Call this before undo / new game /
   * colour change.
   */
  const cancelPendingOpponent = useCallback(() => {
    moveGenerationRef.current += 1;
    if (opponentTimeoutRef.current != null) {
      clearTimeout(opponentTimeoutRef.current);
      opponentTimeoutRef.current = null;
    }
    engineRef.current?.cancel?.();
  }, []);

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

    // Superseded while thinking (undo / new game / colour change) → discard.
    // The action that cancelled us is responsible for resetting UI state.
    if (myGen !== moveGenerationRef.current) return;

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
  }, [syncState, speak]);

  opponentMoveRef.current = opponentMove;

  // ── Shared post-player-move logic ─────────────────────────────────────────

  /**
   * Called after any successful player move (voice or touch).
   * We do NOT speak the player's own move — only the engine announces moves.
   * Exception: check, checkmate, stalemate caused by the player's move are
   * spoken because they end or decisively change the game.
   */
  const finishPlayerMove = useCallback(
    (played: Move) => {
      setLastMove({ from: played.from, to: played.to });
      setHeardText('');
      syncState();
      emitEvent('success');

      const game = gameRef.current;
      const moveSAN = played.san;

      if (game.isGameOver()) {
        // Game ends on player's move → still announce it
        const endMsg = gameStateAnnouncement(game);
        setWaitingForUser(false);
        setStatus(`${moveSAN}  •  ${endMsg}`);
        speak(endMsg);
      } else if (game.isCheck()) {
        // Player gives check → announce it so they know
        setStatus(`${moveSAN}  •  Échec !`);
        speak('Échec !');
        setWaitingForUser(false);
        opponentMoveRef.current();
      } else {
        // Normal move — show in status bar, stay silent
        setStatus(`Coup joué : ${moveSAN}`);
        setWaitingForUser(false);
        opponentMoveRef.current();
      }
    },
    [syncState, emitEvent, speak],
  );

  // ── undoMove ──────────────────────────────────────────────────────────────

  /**
   * Undo the player's last move AND the engine's response.
   * Returns the game to the player's turn and re-announces the engine's
   * previous move (if any) so the player can re-orient.
   */
  const undoMove = useCallback(() => {
    const game = gameRef.current;

    // Abort any pending/in-flight engine turn first, so a late Stockfish
    // result cannot land on the restored position.
    cancelPendingOpponent();

    const allMoves = game.history({ verbose: true }) as Move[];

    // Need at least 2 half-moves to undo (player + engine)
    if (allMoves.length < 2) {
      // Only one half-move: undo it if it was the player's
      if (allMoves.length === 1 && allMoves[0].color === playerColorRef.current) {
        game.undo();
        syncState();
        setLastMove(null);
        setWaitingForUser(true);
        setIsOpponentThinking(false);
        setIsGameOver(false);
        setHeardText('');
        setStatus('À toi de jouer.');
        speak('Coup annulé. Début de la partie.');
      }
      return;
    }

    // Undo engine's last move, then player's last move
    game.undo();
    game.undo();

    syncState();
    setIsOpponentThinking(false);
    setIsGameOver(false);
    setHeardText('');
    setWaitingForUser(true);

    // Restore last-move highlight to the move just before the undo
    const remaining = game.history({ verbose: true }) as Move[];
    if (remaining.length > 0) {
      const lm = remaining[remaining.length - 1];
      setLastMove({ from: lm.from, to: lm.to });
    } else {
      setLastMove(null);
    }

    // Find the engine's last move in the remaining history and re-announce it
    const engineColor: PlayerColor = playerColorRef.current === 'w' ? 'b' : 'w';
    const lastEngineMove = remaining
      .slice()
      .reverse()
      .find(m => m.color === engineColor) ?? null;

    if (lastEngineMove) {
      const announcement = verbalMove(lastEngineMove);
      setStatus(announcement);
      speak(`Coup annulé. Dernier coup de l'adversaire : ${announcement}`);
    } else {
      setStatus('À toi de jouer.');
      speak('Coup annulé. Début de la partie.');
    }
  }, [syncState, speak, cancelPendingOpponent]);

  // ── applyUserMove (voice / text input) ────────────────────────────────────

  const applyUserMove = useCallback(
    (raw: string) => {
      const input = normalize(raw);

      // ── Special commands — bypass the turn guard ──────────────────────
      if (/\brepete\b/.test(input)) { repeatLast(); return; }
      if (input.includes('resum'))  { summarizeGameHistory(); return; }
      if (/\b(annule|annuler|cancel)\b/.test(input)) { undoMove(); return; }

      const game = gameRef.current;
      if (!waitingForUser || isOpponentThinking || game.isGameOver()) return;

      setHeardText(raw ? `« ${raw} »` : '');
      const parsed = parseSpoken(raw, game);

      if (parsed.kind === 'unknown') {
        setStatus('Coup non reconnu. Répète.');
        if (looksLikeChessMove(input)) emitEvent('error');
        return;
      }

      // For 'ambiguous', play the best guess — vocabulary is restricted
      // enough that the top fuzzy match is almost always correct.
      const moveToPlay = parsed.kind === 'ambiguous' ? parsed.guess : parsed.move;

      try {
        const played = game.move({
          from: moveToPlay.from,
          to: moveToPlay.to,
          promotion: 'q',
        }) as Move;
        finishPlayerMove(played);
      } catch {
        setStatus('Coup illégal. Répète.');
        emitEvent('error');
      }
    },
    [waitingForUser, isOpponentThinking, finishPlayerMove,
     emitEvent, repeatLast, summarizeGameHistory, undoMove],
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
      cancelPendingOpponent();
      engineRef.current?.newGame?.();
      try { Speech.stop(); } catch { /* ignore */ }
      gameRef.current.reset();
      lastSpokenRef.current = '';
      setLastMove(null);
      setHeardText('');
      setIsGameOver(false);
      setIsOpponentThinking(false);
      setMoveEvent(null);
      setIsSpeaking(false);
      syncState();

      if (color === 'b') {
        setWaitingForUser(false);
        setStatus("L'adversaire prépare son coup…");
        opponentTimeoutRef.current = setTimeout(() => {
          opponentTimeoutRef.current = null;
          opponentMoveRef.current();
        }, 1200);
      } else {
        setWaitingForUser(true);
        setStatus('À toi de jouer.');
      }
    },
    [syncState, cancelPendingOpponent],
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
        isSpeaking,
        applyUserMove,
        movePieceBySquare,
        getLegalDestinations,
        newGame,
        changeColor,
        repeatLast,
        summarizeGame: summarizeGameHistory,
        undoMove,
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
