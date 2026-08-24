import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Chess } from 'chess.js';
import { ChessBoard } from '@/components/ChessBoard';
import { BoardCoordinatesToggle } from '@/components/BoardCoordinatesToggle';
import { ChessBoardSection } from '@/components/game/ChessBoardSection';
import { GamePlaybackControls } from '@/components/gameLibrary/GamePlaybackControls';
import { GameReaderMoveList } from '@/components/gameLibrary/GameReaderMoveList';
import { useBoardCoordinates } from '@/hooks/useBoardCoordinates';
import { useColors } from '@/hooks/useColors';
import { usePreferences } from '@/hooks/usePreferences';
import { useTranslation } from '@/hooks/useTranslation';
import { UniversalEvalGauge } from '@/lib/evaluation/UniversalEvalGauge';
import { useSharedStockfishRuntime } from '@/lib/engines/runtime';
import type { BoardPiece } from '@/lib/game/types';
import { formatSanForDisplay } from '@/lib/chess/notation';
import type { ChessWorkspacePayload } from '@/lib/workspace/types';
import { useChessWorkspace } from '@/lib/workspace/useChessWorkspace';
import { DesignTokens } from '@/constants/designTokens';

type Props = {
  payload: ChessWorkspacePayload;
  boardSize: number;
  showMoves?: boolean;
  setShowMoves?: (value: boolean) => void;
  showBoard?: boolean;
  setShowBoard?: (value: boolean) => void;
  title?: string;
};

function boardFromFen(fen: string): (BoardPiece | null)[][] {
  return new Chess(fen).board() as (BoardPiece | null)[][];
}

export function UniversalChessWorkspace({
  payload,
  boardSize,
  showMoves = true,
  setShowMoves,
  showBoard = true,
  setShowBoard,
}: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const { chessNotation } = usePreferences();
  const { showCoordinates, toggleCoordinates } = useBoardCoordinates();
  const { engineReady, runtime } = useSharedStockfishRuntime();
  const workspace = useChessWorkspace({
    payload,
    engine: runtime.getService(),
    engineReady,
  });

  const board = useMemo(() => boardFromFen(workspace.currentFen), [workspace.currentFen]);
  const gauge = workspace.evalState.evaluation;
  const bestLabel = useMemo(() => {
    if (!workspace.evalState.bestSan) {
      return workspace.evalState.thinking ? t('parties.loading') : '—';
    }
    return formatSanForDisplay(workspace.evalState.bestSan, chessNotation);
  }, [chessNotation, workspace.evalState.bestSan, workspace.evalState.thinking, t]);
  const canFreePlay =
    payload.workspaceMode === 'analysis' ||
    payload.workspaceMode === 'free-play' ||
    payload.workspaceMode === 'finish-vs-engine';

  return (
    <View style={styles.root}>
      <View style={styles.toggles}>
        {setShowBoard ? (
          <Pressable
            onPress={() => setShowBoard(!showBoard)}
            style={[styles.toggleBtn, { borderColor: colors.border }]}
          >
            <Text style={{ color: colors.foreground, fontSize: 12 }}>
              {showBoard ? 'Masquer l’échiquier' : 'Afficher l’échiquier'}
            </Text>
          </Pressable>
        ) : null}
        <BoardCoordinatesToggle visible={showCoordinates} onToggle={toggleCoordinates} />
        {setShowMoves ? (
          <Pressable
            onPress={() => setShowMoves(!showMoves)}
            style={[styles.toggleBtn, { borderColor: colors.border }]}
          >
            <Text style={{ color: colors.foreground, fontSize: 12 }}>
              {showMoves ? t('parties.hideMoves') : t('parties.showMoves')}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {gauge ? (
        <UniversalEvalGauge
          visible
          mode="analysis"
          scoreCp={gauge.type === 'cp' ? gauge.value : 0}
          mateIn={gauge.type === 'mate' ? gauge.value : null}
          perspective="white"
          testID="workspace-eval-gauge"
        />
      ) : null}

      <Text style={[styles.sideToMove, { color: colors.mutedForeground }]}>
        {workspace.sideToMove === 'white' ? t('game.sideToMoveWhite') : t('game.sideToMoveBlack')}
      </Text>

      {workspace.evalState.thinking ? (
        <View style={styles.engineRow}>
          <ActivityIndicator color={colors.primary} size="small" />
          <Text style={{ color: colors.primary }}>{t('parties.loading')}</Text>
        </View>
      ) : null}

      {!engineReady ? (
        <Text style={[styles.engineMissing, { color: colors.mutedForeground }]}>
          Stockfish indisponible
        </Text>
      ) : null}

      {showBoard ? (
        <ChessBoardSection boardSize={boardSize}>
          <ChessBoard
            board={board}
            lastMove={null}
            isFlipped={payload.orientation === 'black'}
            showCoordinates={showCoordinates}
            size={boardSize}
            sizeMode="wide"
            onSquarePress={
              canFreePlay
                ? undefined
                : undefined
            }
          />
        </ChessBoardSection>
      ) : null}

      <View style={styles.navMeta}>
        <Text style={{ color: colors.mutedForeground }}>
          {workspace.currentPly}/{workspace.mainMoves.length}
        </Text>
        <Text style={{ color: colors.primary }}>{bestLabel}</Text>
      </View>

      <GamePlaybackControls
        isPlaying={false}
        onStart={workspace.goStart}
        onPrev={workspace.goPrev}
        onTogglePlay={workspace.goNext}
        onNext={workspace.goNext}
        onEnd={workspace.goEnd}
        onRepeat={workspace.goPrev}
        labels={{
          start: t('parties.start'),
          prev: t('parties.prev'),
          play: t('parties.next'),
          pause: t('parties.next'),
          next: t('parties.next'),
          end: t('parties.end'),
          repeat: t('parties.prev'),
        }}
      />

      {workspace.canReturnToBranch ? (
        <Pressable
          onPress={workspace.returnToBranchRoot}
          style={[styles.returnBtn, { borderColor: colors.border }]}
          testID="workspace-return-branch"
        >
          <Text style={{ color: colors.foreground }}>{t('quiz.stockfishBack')}</Text>
        </Pressable>
      ) : null}

      {showMoves ? (
        <GameReaderMoveList
          sans={payload.moves?.map((move) => move.san) ?? []}
          currentPly={workspace.currentPly}
          onSelectPly={workspace.jumpToPly}
          testID="workspace-moves"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    gap: DesignTokens.spacing.md,
  },
  toggles: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  toggleBtn: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  sideToMove: {
    textAlign: 'center',
    fontSize: 14,
  },
  engineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  navMeta: {
    alignItems: 'center',
    gap: 4,
  },
  returnBtn: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignSelf: 'center',
  },
  engineMissing: {
    textAlign: 'center',
    fontSize: 12,
  },
});
