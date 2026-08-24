/**
 * Interactive analysis overlay — thin container around the universal workspace.
 * All navigation, variant, eval, and Stockfish logic lives in UniversalChessWorkspace.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Chess } from 'chess.js';
import { UniversalChessWorkspace } from '@/components/workspace/UniversalChessWorkspace';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { computeBoardSize, fitBoardSizeToViewport } from '@/lib/game/boardSize';
import type { ReviewLaunchPayload } from '@/lib/review/ReviewSessionRegistry';
import type { ChessWorkspacePayload, WorkspaceMove } from '@/lib/workspace/types';
import { DesignTokens } from '@/constants/designTokens';

type Props = { visible: boolean; payload: ReviewLaunchPayload; onClose: () => void };

/** Build WorkspaceMove[] with correct per-ply FENs from a start FEN + SAN array. */
function buildWorkspaceMoves(
  startFen: string,
  moveSans: readonly string[],
): WorkspaceMove[] {
  const chess = new Chess(startFen);
  const moves: WorkspaceMove[] = [];
  for (let i = 0; i < moveSans.length; i++) {
    const san = moveSans[i]!;
    const fenBefore = chess.fen();
    let played;
    try {
      played = chess.move(san);
    } catch {
      break;
    }
    if (!played) break;
    moves.push({
      ply: i + 1,
      san: played.san,
      fenBefore,
      fenAfter: chess.fen(),
      playedBy: fenBefore.split(' ')[1] === 'b' ? 'black' : 'white',
    });
  }
  return moves;
}

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
      subtitle: payload.objective ? `Objectif : ${payload.objective}` : undefined,
      initialFen: payload.startFen,
      orientation: payload.orientation,
      playerColor: payload.orientation,
      moves: buildWorkspaceMoves(payload.startFen, payload.moveSans),
      markers: payload.firstMajorTurn
        ? [
            {
              id: 'primary-marker',
              ply: payload.firstMajorTurn.playerMoveNumber,
              type: 'objective-lost' as const,
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
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
      testID="analysis-overlay-modal"
    >
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

          <Pressable
            onPress={handleClose}
            testID="analysis-close"
            style={[styles.closeBtn, { borderColor: colors.border }]}
          >
            <Text style={{ color: colors.primary }}>{t('quiz.stockfishBack')}</Text>
          </Pressable>
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
  closeBtn: {
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: DesignTokens.radius.sm,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
});
