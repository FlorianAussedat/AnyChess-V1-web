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
import {
  gameStateAnnouncement,
  sanToVerbal,
  verbalMove,
} from '@/lib/chessParser';
import { normalizeTranscript, parseChessVoice } from '@/lib/voice';
import type { ChessEngine } from '@/lib/engine';
import { createOpponentEngine } from '@/lib/engines';
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

// ── Types ──────────────────────────────────────────────────────────────────

export type PlayerColor = 'w' | 'b';

export type BoardPiece = {
  square: string;
  type: string;
  color: 'w' | 'b';
};

export type LastMove = { from: string; to: string };

/** Emitted after every user-move attempt so the UI can trigger haptics/sounds. */
export type MoveEvent = {
  kind: 'success' | 'error';
  id: number;
  source?: MoveInputSource;
};

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
  applyUserMove: (raw: string, source?: MoveInputSource) => void;
  movePieceBySquare: (from: string, to: string) => boolean;
  getLegalDestinations: (square: string) => string[];
  newGame: () => void;
  changeColor: (color: PlayerColor) => void;
  repeatLast: () => void;
  summarizeGame: () => void;
  undoMove: () => void;
  /** Build current game as PGN text (in progress or finished). */
  exportPgn: () => string;
  /** Download/share the current game as a .pgn file. */
  downloadPgn: () => void;
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
  const strengthBandIdRef = useRef(DEFAULT_STRENGTH_BAND_ID);

  // ── Opponent engine (Stockfish on web, built-in fallback on native) ─────────
  // We only ever talk to the ChessEngine interface — the concrete engine is
  // chosen by createOpponentEngine() and can be swapped without touching this
  // file. Recreated when the strength band changes / on new game (fresh Elo jitter).
  const engineRef = useRef<ChessEngine | null>(null);
  if (engineRef.current === null) {
    const elo = eloForBand(getStrengthBand(DEFAULT_STRENGTH_BAND_ID));
    engineRef.current = createOpponentEngine({ elo });
  }

  // Monotonic token that identifies the "current" engine turn. Bumping it
  // invalidates any in-flight engine computation (undo / new game / colour
  // change while the engine is thinking), so a late result is safely ignored.
  const moveGenerationRef = useRef(0);

  const recreateEngine = useCallback((bandId: string) => {
    const prev = engineRef.current;
    prev?.cancel?.();
    prev?.destroy?.();
    const elo = eloForBand(getStrengthBand(bandId));
    const next = createOpponentEngine({ elo });
    engineRef.current = next;
    next.init?.().catch(() => {
      /* engine failed to load — opponentMove will simply produce no move */
    });
  }, []);

  useEffect(() => {
    engineRef.current?.init?.().catch(() => {
      /* engine failed to load — opponentMove will simply produce no move */
    });
    return () => {
      engineRef.current?.destroy?.();
    };
  }, []);

  // Mirror the shared SpeechService "speaking" signal into React state so the
  // mic layer can pause recognition while TTS (player move + engine reply) is
  // playing and resume once the whole queue drains.
  useEffect(() => {
    const unsubscribe = speechService.onSpeakingChange(setIsSpeaking);
    return () => {
      unsubscribe();
      speechService.cancel('unmount');
    };
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
  const [strengthBandId, setStrengthBandIdState] = useState(DEFAULT_STRENGTH_BAND_ID);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const syncState = useCallback(() => {
    const g = gameRef.current;
    setBoard(g.board() as (BoardPiece | null)[][]);
    setHistory(g.history());
    setIsGameOver(g.isGameOver());
  }, []);

  /**
   * Speak text via the shared SpeechService.  Utterances are queued so the
   * player's move announcement plays fully before the engine's reply.  The
   * mic layer pauses while `isSpeaking` is true and resumes when it clears.
   *
   * Pass `{ flush: true }` to interrupt current speech (repeat / new game).
   */
  const speak = useCallback((text: string, opts?: { flush?: boolean }) => {
    lastSpokenRef.current = text;
    speechService.speak(text, opts);
  }, []);

  const emitEvent = useCallback((kind: 'success' | 'error', source?: MoveInputSource) => {
    setMoveEvent(prev => ({ kind, id: (prev?.id ?? 0) + 1, source }));
  }, []);

  const setStrengthBandId = useCallback(
    (id: string) => {
      strengthBandIdRef.current = id;
      setStrengthBandIdState(id);
      recreateEngine(id);
    },
    [recreateEngine],
  );

  const repeatLast = useCallback(() => {
    speak(lastSpokenRef.current || 'Aucun coup à répéter.', { flush: true });
  }, [speak]);

  // ── summarizeGame ─────────────────────────────────────────────────────────

  const summarizeGameHistory = useCallback(() => {
    const moves = gameRef.current.history();
    if (!moves.length) {
      speak('Aucun coup joué pour le moment.', { flush: true });
      return;
    }
    // Flush anything playing, then queue each half-move; the SpeechService
    // plays them back-to-back and clears isSpeaking when finished.
    speechService.cancel('summarize');
    moves.forEach((san, i) => {
      const pairNum = Math.floor(i / 2) + 1;
      const isWhite = i % 2 === 0;
      const verbal = sanToVerbal(san);
      const text = isWhite ? `${pairNum}. ${verbal}` : verbal;
      speechService.speak(text, { rate: 0.9 });
    });
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
   *
   * The player's validated move is always announced aloud — including
   * captures, checks, checkmate, promotions and castling — via
   * gameStateAnnouncement(verbalMove(...)).  The announcement is queued, so
   * when the engine replies its own announcement plays right after (the mic
   * stays paused for the whole sequence).
   */
  const finishPlayerMove = useCallback(
    (played: Move, source: MoveInputSource) => {
      setLastMove({ from: played.from, to: played.to });
      setHeardText('');
      syncState();
      if (shouldEmitMoveRecognizedFeedback(source)) {
        emitEvent('success', source);
      }

      const game = gameRef.current;

      // verbalMove handles piece name, capture ("prend"), castling and
      // promotion; gameStateAnnouncement appends check / checkmate / draw.
      const playerAnnouncement = gameStateAnnouncement(game, verbalMove(played));

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
    speechService.cancel('undo');

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
    (raw: string, source: MoveInputSource = 'voice') => {
      const input = normalizeTranscript(raw);
      const game = gameRef.current;
      const parsed = parseChessVoice(raw, game, { mode: 'classic' });

      // ── App commands — bypass the turn guard ──────────────────────────
      if (parsed.type === 'command') {
        if (parsed.command === 'repeat') { repeatLast(); return; }
        if (parsed.command === 'summarize') { summarizeGameHistory(); return; }
        if (parsed.command === 'undo') { undoMove(); return; }
        return;
      }

      if (!waitingForUser || isOpponentThinking || game.isGameOver()) return;

      setHeardText(raw ? `« ${raw} »` : '');

      if (parsed.type === 'unrecognized') {
        setStatus('Coup non reconnu. Répète.');
        if (looksLikeChessMove(input)) emitEvent('error', source);
        return;
      }

      if (parsed.type === 'ambiguous') {
        setStatus('Coup ambigu. Précise la case de départ.');
        emitEvent('error', source);
        return;
      }

      if (parsed.type === 'illegal') {
        setStatus('Coup illégal. Répète.');
        emitEvent('error', source);
        return;
      }

      try {
        const played = game.move({
          from: parsed.move.from,
          to: parsed.move.to,
          promotion: parsed.move.promotion ?? 'q',
        }) as Move;
        finishPlayerMove(played, source);
      } catch {
        setStatus('Coup illégal. Répète.');
        emitEvent('error', source);
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
        finishPlayerMove(played, 'touch');
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
      speechService.cancel('new-game');
      // Fresh Elo jitter within the selected strength band for each new game.
      recreateEngine(strengthBandIdRef.current);
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
    [syncState, cancelPendingOpponent, recreateEngine],
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
  }, []);

  const exportPgn = useCallback(() => buildPgn(), [buildPgn]);

  const downloadPgn = useCallback(() => {
    downloadPgnFile(anyChessPgnFilename(), buildPgn());
  }, [buildPgn]);

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
        exportPgn,
        downloadPgn,
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
