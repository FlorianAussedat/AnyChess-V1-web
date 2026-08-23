/**
 * Finish-game overlay — play to regulatory end from exact FEN (strict-best).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Chess } from 'chess.js';
import { ChessBoard } from '@/components/ChessBoard';
import { ChessBoardSection } from '@/components/game/ChessBoardSection';
import { ChessMoveInput } from '@/components/game/ChessMoveInput';
import { ChessMoveKeypad } from '@/components/game/ChessMoveKeypad';
import { ChessKeyboardToggle } from '@/components/game/ChessKeyboardToggle';
import { GameMicButton } from '@/components/game/GameMicButton';
import { BoardToolbar } from '@/components/BoardToolbar';
import { AppButton } from '@/components/ui/AppButton';
import { useColors } from '@/hooks/useColors';
import { useBoardCoordinates } from '@/hooks/useBoardCoordinates';
import { useTranslation } from '@/hooks/useTranslation';
import { useChessInputMode } from '@/hooks/useChessInputMode';
import {
  useExerciseBoardTouch,
  useExerciseSpeechInput,
} from '@/hooks/useExerciseChessInput';
import { EndgameTrainingSession, type SessionSnapshot as DefendSnapshot } from '@/lib/endgameTraining';
import {
  TheoreticalEndgameSession,
  getPositionById,
  type SessionSnapshot as TheoreticalSnapshot,
} from '@/lib/theoreticalEndgame';
import { useSharedStockfishRuntime } from '@/lib/engines/runtime';
import { EndgameEngineStatusBanner } from '@/lib/engines/runtime';
import { computeBoardSize, fitBoardSizeToViewport } from '@/lib/game/boardSize';
import type { BoardPiece, LastMove } from '@/contexts/GameContext';
import type { FinishGamePayload } from '@/lib/review/ReviewSessionRegistry';
import { DesignTokens } from '@/constants/designTokens';

type Props = {
  visible: boolean;
  payload: FinishGamePayload;
  onClose: () => void;
};

function boardFromFen(fen: string): (BoardPiece | null)[][] {
  return new Chess(fen).board() as (BoardPiece | null)[][];
}

type FinishSnapshot = DefendSnapshot | TheoreticalSnapshot;

export function FinishGameOverlay({ visible, payload, onClose }: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const { showCoordinates, toggleCoordinates } = useBoardCoordinates();
  const { inputMode, toggleChessInputMode, keypadActive } = useChessInputMode();
  const { width, height } = useWindowDimensions();
  const isTheoretical = payload.mode === 'theoretical';
  const defendSessionRef = useRef(new EndgameTrainingSession({}));
  const theoreticalSessionRef = useRef(new TheoreticalEndgameSession());
  const [snap, setSnap] = useState<FinishSnapshot>(() =>
    isTheoretical
      ? theoreticalSessionRef.current.snapshot()
      : defendSessionRef.current.snapshot(),
  );
  const [busy, setBusy] = useState(false);
  const [draftMove, setDraftMove] = useState('');
  const startedRef = useRef(false);

  const { snapshot: engineSnap, engineReady, retry: retryEngine, runtime } =
    useSharedStockfishRuntime();

  const boardSize = useMemo(() => {
    const wide = computeBoardSize(width, 'wide');
    return fitBoardSizeToViewport(wide, height, 300);
  }, [width, height]);

  const refresh = useCallback((next: FinishSnapshot) => setSnap(next), []);

  useEffect(() => {
    if (!visible) {
      startedRef.current = false;
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;
    void (async () => {
      setBusy(true);
      try {
        if (isTheoretical) {
          const session = theoreticalSessionRef.current;
          if (engineReady) session.setAnalyzer(runtime.getService());
          const pos =
            getPositionById(payload.positionId ?? '') ??
            ({
              id: payload.positionId ?? 'finish',
              themeId: 'queen-mate' as const,
              initialFen: payload.fen,
              playerColor: payload.orientation,
              objective: 'WIN' as const,
              completion: { type: 'CHECKMATE' as const },
              targetUserMoves: 10,
              certification: {
                type: 'ENGINE' as const,
                engine: 'stockfish',
                depth: 12,
                result: 'WIN' as const,
              },
              diagramOrientation: payload.orientation,
              active: true,
              explanation: {
                fr: { principle: '', seek: '', method: '', avoid: '' },
                en: { principle: '', seek: '', method: '', avoid: '' },
              },
              tags: [],
            });
          refresh(
            await session.startFinishGameFromState({
              position: pos,
              fen: payload.fen,
              moveSans: payload.moveSans,
              lockedOutcome:
                payload.lockedOutcome === 'success' ? 'success' : 'theoretical-loss',
            }),
          );
        } else {
          const session = defendSessionRef.current;
          if (engineReady) session.setAnalyzer(runtime.getService());
          const pos = {
            id: payload.positionId ?? 'finish',
            fen: payload.fen,
            defender: payload.orientation,
            objective: 'DRAW' as const,
            source: { provider: 'finish-game', license: 'internal' },
            family: 'mixed',
            materialSignature: '',
            tags: [],
            quality: { initialEvaluation: 0, validationKind: 'stockfish' as const },
          };
          refresh(
            await session.startFinishGameFromState({
              position: pos,
              fen: payload.fen,
              moveSans: payload.moveSans,
              movesResisted: 0,
              lockedOutcome: payload.lockedOutcome as import('@/lib/endgameTraining/domain/types').AttemptOutcome,
            }),
          );
        }
      } finally {
        setBusy(false);
      }
    })();
  }, [visible, payload, runtime, refresh, engineReady, isTheoretical]);

  useEffect(() => {
    if (!engineReady) return;
    if (isTheoretical) {
      theoreticalSessionRef.current.setAnalyzer(runtime.getService());
    } else {
      defendSessionRef.current.setAnalyzer(runtime.getService());
    }
  }, [engineReady, runtime, isTheoretical]);

  const activeSession = isTheoretical
    ? theoreticalSessionRef.current
    : defendSessionRef.current;

  const canMove =
    engineReady &&
    !busy &&
    snap.phase === 'finish-game' &&
    !new Chess(snap.fen).isGameOver();

  const playMove = async (from: string, to: string, promotion?: string) => {
    if (!canMove) return;
    setBusy(true);
    try {
      refresh(await activeSession.attemptMove(from, to, promotion ?? 'q'));
    } finally {
      setBusy(false);
    }
  };

  const { touchSelected, legalDests, onSquarePress } = useExerciseBoardTouch({
    canAct: canMove,
    getLegalDestinations: (from) => activeSession.getLegalDestinations(from),
    onMove: playMove,
    onSan: (san) => void activeSession.answerSan(san).then(refresh),
  });

  const speech = useExerciseSpeechInput({
    enabled: visible && inputMode === 'classic' && canMove,
    onSan: (san) => void activeSession.answerSan(san).then(refresh),
  });

  const board = useMemo(() => boardFromFen(snap.fen), [snap.fen]);

  const isFlipped = isTheoretical
    ? (snap as TheoreticalSnapshot).playerColor === 'b'
    : (snap as DefendSnapshot).defender === 'b';

  const confirmClose = () => {
    Alert.alert(
      'Quitter Finir la partie ?',
      'Le résultat de l’exercice ne sera pas modifié.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Retour au résultat', onPress: onClose },
      ],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={confirmClose}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Finir la partie
          </Text>

          <ChessBoardSection
            boardSize={boardSize}
            toolbar={
              <BoardToolbar
                label={
                  !isFlipped
                    ? t('puzzle.youPlayWhite')
                    : t('puzzle.youPlayBlack')
                }
                showCoordinates={showCoordinates}
                onToggleCoordinates={() => void toggleCoordinates()}
              />
            }
          >
            <ChessBoard
              board={board}
              lastMove={snap.lastMove as LastMove | null}
              isFlipped={isFlipped}
              selectedSquare={touchSelected}
              legalDots={legalDests}
              onSquarePress={onSquarePress}
              showCoordinates={showCoordinates}
              size={boardSize}
              sizeMode="wide"
            />
          </ChessBoardSection>

          <EndgameEngineStatusBanner
            snapshot={engineSnap}
            onRetry={() => void retryEngine()}
            onBack={confirmClose}
          />

          {busy && <ActivityIndicator color={colors.primary} />}

          {!!snap.lastFeedback && (
            <Text style={{ color: colors.foreground, textAlign: 'center' }}>
              {snap.lastFeedback}
            </Text>
          )}

          {canMove && (
            <>
              {inputMode === 'classic' && (
                <GameMicButton
                  showRecognized={speech.showRecognized}
                  isListening={speech.listening}
                  micActive
                  onToggle={() => void speech.toggleListening()}
                  testID="finish-game-mic"
                />
              )}
              <ChessKeyboardToggle
                variant="classic"
                active={keypadActive}
                onToggle={() => void toggleChessInputMode()}
              />
              {keypadActive ? (
                <ChessMoveKeypad
                  fen={snap.fen}
                  value={draftMove}
                  onChangeText={setDraftMove}
                  onSubmit={(san) => {
                    setDraftMove('');
                    void activeSession.answerSan(san).then(refresh);
                  }}
                  testID="finish-game-keypad"
                />
              ) : (
                <ChessMoveInput
                  inputType="chess-move"
                  fen={snap.fen}
                  onSubmit={(raw) => void activeSession.answerSan(raw).then(refresh)}
                  enabled
                  autoSubmit
                  testID="finish-game-move-input"
                />
              )}
            </>
          )}

          <AppButton
            label="Retour au résultat"
            onPress={confirmClose}
            variant="secondary"
            testID="finish-game-back-result"
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    padding: DesignTokens.spacing.md,
    gap: DesignTokens.spacing.md,
    paddingBottom: DesignTokens.spacing.xl,
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    textAlign: 'center',
  },
});
