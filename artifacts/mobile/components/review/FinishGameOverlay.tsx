/**
 * Finish-game overlay — thin wrapper around UniversalChessWorkspace in finish-vs-engine mode.
 * No game logic lives here: all play, engine, and result tracking is in useChessWorkspace.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
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
import type { FinishGamePayload } from '@/lib/review/ReviewSessionRegistry';
import type { ChessWorkspacePayload, WorkspaceMove } from '@/lib/workspace/types';
import { DesignTokens } from '@/constants/designTokens';

type Props = { visible: boolean; payload: FinishGamePayload; onClose: () => void };

/** Rebuild WorkspaceMove[] with per-ply FENs from start FEN + SAN list. */
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

export function FinishGameOverlay({ visible, payload, onClose }: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const [showMoves, setShowMoves] = useState(false);
  const [showBoard, setShowBoard] = useState(true);

  const boardSize = useMemo(() => {
    const wide = computeBoardSize(width, 'wide');
    return fitBoardSizeToViewport(wide, height, 300);
  }, [width, height]);

  // Engine color = the other side (user plays payload.orientation)
  const userColor = payload.orientation;
  const engineColorFen = payload.fen.split(' ')[1];
  const startingSide: 'white' | 'black' =
    engineColorFen === 'b' ? 'black' : 'white';
  const engineColor: 'white' | 'black' = userColor === 'white' ? 'black' : 'white';

  const workspacePayload: ChessWorkspacePayload = useMemo(
    () => ({
      schemaVersion: 1,
      workspaceMode: 'finish-vs-engine',
      source:
        payload.mode === 'defend-draw'
          ? 'defend-draw'
          : payload.mode === 'theoretical'
            ? 'theoretical-endgame'
            : 'other',
      title: 'Finir la partie',
      subtitle:
        userColor === 'white'
          ? t('puzzle.youPlayWhite')
          : t('puzzle.youPlayBlack'),
      initialFen: payload.fen,
      orientation: userColor,
      playerColor: userColor,
      moves: buildWorkspaceMoves(payload.fen, payload.moveSans),
      engineOpponent: {
        enabled: true,
        color: engineColor,
        policy: 'strict-best',
      },
      metadata: {
        legacyLockedOutcome: payload.lockedOutcome,
        legacyPositionId: payload.positionId,
        legacyMode: payload.mode,
        startingSide,
      },
    }),
    [payload, userColor, engineColor, startingSide, t],
  );

  const confirmClose = useCallback(() => {
    Alert.alert(
      'Quitter Finir la partie ?',
      "Le r\u00e9sultat de l\u2019exercice ne sera pas modifi\u00e9.",
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: 'Retour au résultat', onPress: onClose },
      ],
    );
  }, [onClose, t]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={confirmClose}
      testID="finish-game-overlay-modal"
    >
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Finir la partie
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
            onPress={confirmClose}
            style={[styles.closeBtn, { borderColor: colors.border }]}
            testID="finish-game-back-result"
          >
            <Text style={{ color: colors.foreground }}>Retour au résultat</Text>
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
