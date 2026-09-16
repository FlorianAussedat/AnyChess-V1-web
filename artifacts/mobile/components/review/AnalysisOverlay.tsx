/**
 * Interactive analysis overlay — universal, opens above result screen.
 */
import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Chess } from 'chess.js';
import { ChessBoard } from '@/components/ChessBoard';
import { ChessBoardSection } from '@/components/game/ChessBoardSection';
import { BoardToolbar } from '@/components/BoardToolbar';
import { AppButton } from '@/components/ui/AppButton';
import { UniversalEvalGauge } from '@/lib/evaluation/UniversalEvalGauge';
import { useColors } from '@/hooks/useColors';
import { useBoardCoordinates } from '@/hooks/useBoardCoordinates';
import { useTranslation } from '@/hooks/useTranslation';
import { usePreferences } from '@/hooks/usePreferences';
import { formatSanForDisplay } from '@/lib/chess/notation';
import { computeBoardSize, fitBoardSizeToViewport } from '@/lib/game/boardSize';
import type { BoardPiece } from '@/contexts/GameContext';
import type { ReviewLaunchPayload } from '@/lib/review/ReviewSessionRegistry';
import { useInteractiveAnalysis } from '@/lib/review/useInteractiveAnalysis';
import { useSharedStockfishRuntime } from '@/lib/engines/runtime';
import type { DefenseAnalyzer } from '@/lib/defendDraw/defenseTypes';
import { useExerciseBoardTouch } from '@/hooks/useExerciseChessInput';
import { DesignTokens } from '@/constants/designTokens';

type Props = {
  visible: boolean;
  payload: ReviewLaunchPayload;
  onClose: () => void;
};

function boardFromFen(fen: string): (BoardPiece | null)[][] {
  return new Chess(fen).board() as (BoardPiece | null)[][];
}

export function AnalysisOverlay({ visible, payload, onClose }: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const { chessNotation } = usePreferences();
  const { showCoordinates, toggleCoordinates } = useBoardCoordinates();
  const { width, height } = useWindowDimensions();
  const { engineReady, runtime } = useSharedStockfishRuntime();

  const boardSize = useMemo(() => {
    const wide = computeBoardSize(width, 'wide');
    return fitBoardSizeToViewport(wide, height, 280);
  }, [width, height]);

  const engine = runtime.getService() as DefenseAnalyzer | null;

  const analysis = useInteractiveAnalysis({
    startFen: payload.startFen,
    moveSans: payload.moveSans,
    orientation: payload.orientation,
    engine,
    engineReady,
  });

  const { touchSelected, legalDests, onSquarePress } = useExerciseBoardTouch({
    canAct: visible && engineReady,
    getLegalDestinations: (from) => {
      try {
        return new Chess(analysis.line.fen)
          .moves({ square: from as never, verbose: true })
          .map((m) => m.to);
      } catch {
        return [];
      }
    },
    onMove: (from, to, promotion) => analysis.tryFreeMove(from, to, promotion),
    onSan: () => {},
  });

  const board = useMemo(() => boardFromFen(analysis.line.fen), [analysis.line.fen]);

  const bestLabel = useMemo(() => {
    if (analysis.gameOver) return 'Partie terminée';
    if (!analysis.evalState.bestSan) {
      return analysis.evalState.thinking ? '…' : '—';
    }
    return `Meilleur coup : ${formatSanForDisplay(analysis.evalState.bestSan, chessNotation)}`;
  }, [analysis, chessNotation]);

  const handleClose = useCallback(() => onClose(), [onClose]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {t('quiz.endgameAnalyse')}
          </Text>

          <UniversalEvalGauge
            scoreCp={analysis.evalState.scoreCp}
            mateIn={analysis.evalState.mateIn}
            perspective={payload.orientation}
            scoreIsPerspectivePov
            visible
            mode="analysis"
            testID="analysis-eval-gauge"
          />

          <Text style={{ color: colors.primary, textAlign: 'center' }} testID="analysis-best-move">
            {bestLabel}
          </Text>

          {analysis.evalState.thinking && (
            <ActivityIndicator color={colors.primary} />
          )}

          <ChessBoardSection
            boardSize={boardSize}
            toolbar={
              <BoardToolbar
                label={t('parties.reader')}
                showCoordinates={showCoordinates}
                onToggleCoordinates={() => void toggleCoordinates()}
              />
            }
          >
            <ChessBoard
              board={board}
              lastMove={null}
              isFlipped={payload.orientation === 'black'}
              selectedSquare={touchSelected}
              legalDots={legalDests}
              onSquarePress={onSquarePress}
              showCoordinates={showCoordinates}
              size={boardSize}
              sizeMode="wide"
            />
          </ChessBoardSection>

          <View style={styles.nav}>
            <AppButton label="◀" onPress={() => analysis.stepMain(-1)} variant="secondary" />
            <Text style={{ color: colors.mutedForeground }}>
              {analysis.line.mainPly}/{payload.moveSans.length}
            </Text>
            <AppButton label="▶" onPress={() => analysis.stepMain(1)} variant="secondary" />
          </View>

          {analysis.canReturnToBranch && (
            <AppButton
              label="Retour à la position"
              onPress={analysis.returnToBranchRoot}
              variant="secondary"
              testID="analysis-return-branch"
            />
          )}

          <AppButton label={t('quiz.stockfishBack')} onPress={handleClose} testID="analysis-close" />
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
  nav: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
});
