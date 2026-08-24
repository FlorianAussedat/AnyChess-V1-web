/**
 * Interactive analysis overlay — now a thin container around the universal workspace.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { UniversalChessWorkspace } from '@/components/workspace/UniversalChessWorkspace';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { computeBoardSize, fitBoardSizeToViewport } from '@/lib/game/boardSize';
import type { ReviewLaunchPayload } from '@/lib/review/ReviewSessionRegistry';
import type { ChessWorkspacePayload } from '@/lib/workspace/types';
import { DesignTokens } from '@/constants/designTokens';

type Props = { visible: boolean; payload: ReviewLaunchPayload; onClose: () => void };

export function AnalysisOverlay({ visible, payload, onClose }: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const [showMoves, setShowMoves] = useState(true);
  const [showBoard, setShowBoard] = useState(true);

  const boardSize = useMemo(() => {
    const wide = computeBoardSize(width, 'wide');
    return fitBoardSizeToViewport(wide, height, 280);
  }, [width, height]);

  const workspacePayload: ChessWorkspacePayload = useMemo(
    () => ({
      schemaVersion: 1,
      workspaceMode: 'analysis',
      source:
        payload.mode === 'defend-draw'
          ? 'defend-draw'
          : payload.mode === 'theoretical'
            ? 'theoretical-endgame'
            : 'other',
      title: t('quiz.endgameAnalyse'),
      subtitle: payload.objective ? `${payload.objective}` : undefined,
      initialFen: payload.startFen,
      orientation: payload.orientation,
      playerColor: payload.orientation,
      moves: payload.moveSans.map((san, index) => ({
        ply: index + 1,
        san,
        fenBefore: index === 0 ? payload.startFen : payload.startFen,
        fenAfter: payload.startFen,
        playedBy:
          (index + (payload.startFen.split(' ')[1] === 'b' ? 1 : 0)) % 2 === 0 ? 'black' : 'white',
      })),
      markers: payload.firstMajorTurn
        ? [
            {
              id: 'primary-marker',
              ply: payload.firstMajorTurn.playerMoveNumber,
              type: 'objective-lost',
              label: payload.firstMajorTurn.message,
            },
          ]
        : undefined,
      metadata: {
        legacyReviewMode: payload.mode,
        parentResultKey: payload.parentResultKey,
      },
    }),
    [payload, t],
  );

  const handleClose = useCallback(() => onClose(), [onClose]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {t('quiz.endgameAnalyse')}
          </Text>
          <UniversalChessWorkspace
            payload={workspacePayload}
            boardSize={boardSize}
            showMoves={showMoves}
            setShowMoves={setShowMoves}
            showBoard={showBoard}
            setShowBoard={setShowBoard}
          />
          <Text
            style={{ color: colors.primary, textAlign: 'center' }}
            testID="analysis-close"
            onPress={handleClose}
          >
            {t('quiz.stockfishBack')}
          </Text>
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
