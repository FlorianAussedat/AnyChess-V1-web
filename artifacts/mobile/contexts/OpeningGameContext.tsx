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
import { createOpponentEngine } from '@/lib/engines';
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
import type { BoardPiece, LastMove, MoveEvent, PlayerColor } from '@/contexts/GameContext';

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
  applyUserMove: (raw: string) => void;
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

function looksLikeChessMove(normalized: string): boolean {
  if (/\b[a-h][1-8]\b/.test(normalized)) return true;
  if (/\b(pion|cavalier|fou|tour|dame|roi|pawn|knight|bishop|rook|queen|king|roque|castle|petit|grand)\b/.test(normalized)) return true;
  if (/\bprend|takes|captures\b/.test(normalized)) return true;
  return false;
}

interface ProviderProps {
  children: React.ReactNode;
  repertoire: ParsedRepertoire | null;
  repertoireName: string;
  loadError?: string | null;
}

export function OpeningGameProvider({
  children,
  repertoire,
  repertoireName,
  loadError = null,
}: ProviderProps) {
  const gameRef = useRef(new Chess());
  const lastSpokenRef = useRef('');
  const playerColorRef = useRef<PlayerColor>('w');
  const opponentRef = useRef<OpeningOpponent | null>(null);
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
  const [phase, setPhase] = useState<'book' | 'engine'>('book');
  const [theoryExit, setTheoryExit] = useState<TheoryExit | null>(null);
  const [ready, setReady] = useState(false);

  // Build / rebuild opponent when repertoire becomes available.
  useEffect(() => {
    if (!repertoire) {
      setReady(false);
      return;
    }

    const engine = createOpponentEngine();
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
    };
  }, [repertoire]);

  useEffect(() => {
    const unsubscribe = speechService.onSpeakingChange(setIsSpeaking);
    return () => {
      unsubscribe();
      speechService.stop();
    };
  }, []);

  const syncState = useCallback(() => {
    const g = gameRef.current;
    setBoard(g.board() as (BoardPiece | null)[][]);
    setHistory(g.history());
    setIsGameOver(g.isGameOver());
  }, []);

  const syncTheoryUi = useCallback(() => {
    const opp = opponentRef.current;
    setPhase(opp?.getPhase() ?? 'book');
    setTheoryExit(opp?.getTheoryExit() ?? null);
  }, []);

  const speak = useCallback((text: string, opts?: { flush?: boolean }) => {
    lastSpokenRef.current = text;
    speechService.speak(text, opts);
  }, []);

  const emitEvent = useCallback((kind: 'success' | 'error') => {
    setMoveEvent((prev) => ({ kind, id: (prev?.id ?? 0) + 1 }));
  }, []);

  const repeatLast = useCallback(() => {
    speak(lastSpokenRef.current || 'Aucun coup à répéter.', { flush: true });
  }, [speak]);

  const summarizeGameHistory = useCallback(() => {
    const moves = gameRef.current.history();
    if (!moves.length) {
      speak('Aucun coup joué pour le moment.', { flush: true });
      return;
    }
    speechService.stop();
    const exit = opponentRef.current?.getTheoryExit() ?? theoryExit;
    if (exit?.kind === 'player-deviation') {
      speechService.speak(`Rapport : ${exit.message}`);
    } else if (exit?.kind === 'repertoire-end') {
      speechService.speak('Rapport : ligne théorique importée suivie jusqu’à son terme.');
    }
    moves.forEach((san, i) => {
      const pairNum = Math.floor(i / 2) + 1;
      const isWhite = i % 2 === 0;
      const verbal = sanToVerbal(san);
      speechService.speak(isWhite ? `${pairNum}. ${verbal}` : verbal, { rate: 0.9 });
    });
  }, [speak, theoryExit]);

  const cancelPendingOpponent = useCallback(() => {
    moveGenerationRef.current += 1;
    if (opponentTimeoutRef.current != null) {
      clearTimeout(opponentTimeoutRef.current);
      opponentTimeoutRef.current = null;
    }
    opponentRef.current?.cancel();
  }, []);

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
  }, [syncState, speak, syncTheoryUi]);

  opponentMoveRef.current = opponentMove;

  const finishPlayerMove = useCallback(
    (played: Move, beforeFen: string) => {
      setLastMove({ from: played.from, to: played.to });
      setHeardText('');
      syncState();
      emitEvent('success');

      const game = gameRef.current;
      const plyAfter = game.history().length;
      const theoryMsg = opponentRef.current?.onPlayerMove(beforeFen, played, plyAfter) ?? null;
      syncTheoryUi();

      const playerAnnouncement = gameStateAnnouncement(game, verbalMove(played));

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
    [syncState, emitEvent, speak, syncTheoryUi],
  );

  const undoMove = useCallback(() => {
    const game = gameRef.current;
    cancelPendingOpponent();

    const allMoves = game.history({ verbose: true }) as Move[];

    if (allMoves.length < 2) {
      if (allMoves.length === 1 && allMoves[0].color === playerColorRef.current) {
        game.undo();
        opponentRef.current?.onUndo(0);
        syncTheoryUi();
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

    game.undo();
    game.undo();
    opponentRef.current?.onUndo(game.history().length);
    syncTheoryUi();
    syncState();
    setIsOpponentThinking(false);
    setIsGameOver(false);
    setHeardText('');
    setWaitingForUser(true);

    const remaining = game.history({ verbose: true }) as Move[];
    if (remaining.length > 0) {
      const lm = remaining[remaining.length - 1];
      setLastMove({ from: lm.from, to: lm.to });
    } else {
      setLastMove(null);
    }

    const engineColor: PlayerColor = playerColorRef.current === 'w' ? 'b' : 'w';
    const lastEngineMove =
      remaining
        .slice()
        .reverse()
        .find((m) => m.color === engineColor) ?? null;

    if (lastEngineMove) {
      const announcement = verbalMove(lastEngineMove);
      setStatus(announcement);
      speak(`Coup annulé. Dernier coup de l'adversaire : ${announcement}`);
    } else {
      setStatus('À toi de jouer.');
      speak('Coup annulé. Début de la partie.');
    }
  }, [syncState, speak, cancelPendingOpponent, syncTheoryUi]);

  const applyUserMove = useCallback(
    (raw: string) => {
      const input = normalizeTranscript(raw);
      const game = gameRef.current;
      const parsed = parseChessVoice(raw, game, { mode: 'opening' });

      if (parsed.type === 'command') {
        if (parsed.command === 'repeat') {
          repeatLast();
          return;
        }
        if (parsed.command === 'summarize') {
          summarizeGameHistory();
          return;
        }
        if (parsed.command === 'undo') {
          undoMove();
          return;
        }
        return;
      }

      if (!waitingForUser || isOpponentThinking || game.isGameOver()) return;

      setHeardText(raw ? `« ${raw} »` : '');

      if (parsed.type === 'unrecognized') {
        setStatus('Coup non reconnu. Répète.');
        if (looksLikeChessMove(input)) emitEvent('error');
        return;
      }

      if (parsed.type === 'ambiguous') {
        setStatus('Coup ambigu. Précise la case de départ.');
        emitEvent('error');
        return;
      }

      if (parsed.type === 'illegal') {
        setStatus('Coup illégal. Répète.');
        emitEvent('error');
        return;
      }

      const beforeFen = game.fen();

      try {
        const played = game.move({
          from: parsed.move.from,
          to: parsed.move.to,
          promotion: parsed.move.promotion ?? 'q',
        }) as Move;
        finishPlayerMove(played, beforeFen);
      } catch {
        setStatus('Coup illégal. Répète.');
        emitEvent('error');
      }
    },
    [
      waitingForUser,
      isOpponentThinking,
      finishPlayerMove,
      emitEvent,
      repeatLast,
      summarizeGameHistory,
      undoMove,
    ],
  );

  const movePieceBySquare = useCallback(
    (from: string, to: string): boolean => {
      const game = gameRef.current;
      if (!waitingForUser || isOpponentThinking || game.isGameOver()) return false;
      const beforeFen = game.fen();
      try {
        const played = game.move({ from, to, promotion: 'q' }) as Move;
        finishPlayerMove(played, beforeFen);
        return true;
      } catch {
        return false;
      }
    },
    [waitingForUser, isOpponentThinking, finishPlayerMove],
  );

  const getLegalDestinations = useCallback(
    (square: string): string[] => {
      const game = gameRef.current;
      if (!waitingForUser || game.isGameOver()) return [];
      const piece = game.get(square as Square);
      if (!piece || piece.color !== playerColorRef.current) return [];
      try {
        const moves = game.moves({ verbose: true, square: square as Square }) as Move[];
        return [...new Set(moves.map((m) => m.to))];
      } catch {
        return [];
      }
    },
    [waitingForUser],
  );

  const resetForColor = useCallback(
    (color: PlayerColor) => {
      cancelPendingOpponent();
      opponentRef.current?.newGame();
      speechService.stop();
      gameRef.current.reset();
      lastSpokenRef.current = '';
      setLastMove(null);
      setHeardText('');
      setIsGameOver(false);
      setIsOpponentThinking(false);
      setMoveEvent(null);
      setIsSpeaking(false);
      setPhase('book');
      setTheoryExit(null);
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
      commentAfterPly: exit
        ? { ply: exit.ply, text: exit.pgnComment }
        : undefined,
    });
  }, [repertoireName]);

  const exportPgn = useCallback(() => buildPgn(), [buildPgn]);

  const downloadPgn = useCallback(() => {
    downloadPgnFile(anyChessPgnFilename(), buildPgn());
  }, [buildPgn]);

  // Kick off first game once ready (White to move by default).
  useEffect(() => {
    if (ready && repertoire) {
      resetForColor(playerColorRef.current);
    }
    // Only when ready flips true for a repertoire — not on every resetForColor identity change.
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
