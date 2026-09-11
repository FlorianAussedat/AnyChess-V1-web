/**
 * Reusable Lecteur / Analyseur presentation around GameReaderApi.
 */
import React, { useMemo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Chess } from 'chess.js';
import { ChessBoard } from '@/components/ChessBoard';
import { ChessBoardSection } from '@/components/game/ChessBoardSection';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import type { BoardPiece, LastMove } from '@/contexts/GameContext';
import { stripClkTags } from '@/lib/gameLibrary';
import type { GameReaderApi } from '@/lib/gameReader';
import { GameReaderNavControls } from './GameReaderNavControls';
import { GameReaderNotationList } from './GameReaderNotationList';
import { GameReaderPlayersBar } from './GameReaderPlayersBar';
import { ReaderBoardToolbar } from './ReaderBoardToolbar';
import { useReaderKeyboard } from './useReaderKeyboard';

type ToolbarHandlers = {
  voiceActive: boolean;
  onToggleVoice: () => void;
  onRepeat: () => void;
  micActive: boolean;
  onToggleMic: () => void;
  micDisabled?: boolean;
};

type Props = {
  reader: GameReaderApi;
  boardSize: number;
  showCoordinates: boolean;
  topSlot?: React.ReactNode;
  middleSlot?: React.ReactNode;
  bottomSlot?: React.ReactNode;
  showPlayers?: boolean;
  showBoard?: boolean;
  showNotation?: boolean;
  showToolbar?: boolean;
  toolbar?: ToolbarHandlers;
  /** Replaces voice toolbar when provided (AnyLyseur). */
  toolbarSlot?: React.ReactNode;
  arrows?: { from: string; to: string; color?: string }[];
  /** Optional board exploration (AnyLyseur). */
  onSquarePress?: (square: string) => void;
  selectedSquare?: string | null;
  legalDots?: string[];
  notationMaxHeight?: number;
  desktopSplit?: boolean;
  testID?: string;
};

function boardFromFen(fen: string): (BoardPiece | null)[][] {
  return new Chess(fen).board() as (BoardPiece | null)[][];
}

export function SharedGameReaderView({
  reader,
  boardSize,
  showCoordinates,
  topSlot,
  middleSlot,
  bottomSlot,
  showPlayers = true,
  showBoard = true,
  showNotation = true,
  showToolbar = false,
  toolbar,
  toolbarSlot,
  arrows,
  onSquarePress,
  selectedSquare = null,
  legalDots = [],
  notationMaxHeight = 220,
  desktopSplit,
  testID = 'shared-game-reader',
}: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const split = desktopSplit ?? width >= 900;

  useReaderKeyboard({
    onPrev: reader.goToPrevious,
    onNext: reader.goToNext,
    onStart: reader.goToStart,
    onEnd: reader.goToEnd,
  });

  const board = useMemo(() => boardFromFen(reader.currentFen), [reader.currentFen]);
  const lastMove: LastMove | null = reader.lastMoveSquares;

  const comment =
    reader.currentPly > 0 ? stripClkTags(reader.currentMove?.comment) : undefined;

  const boardColumn = (
    <View style={styles.boardCol}>
      {showPlayers ? (
        <GameReaderPlayersBar
          headers={reader.headers}
          whiteLabel={t('common.white')}
          blackLabel={t('common.black')}
        />
      ) : null}
      {topSlot}
      {toolbarSlot
        ? toolbarSlot
        : showToolbar && toolbar
          ? (
            <ReaderBoardToolbar
              flipped={reader.boardFlipped}
              onFlip={reader.flipBoard}
              flipLabel={t('parties.flipBoard')}
              voiceActive={toolbar.voiceActive}
              onToggleVoice={toolbar.onToggleVoice}
              voiceLabel={
                toolbar.voiceActive ? t('parties.pause') : t('parties.play')
              }
              onRepeat={toolbar.onRepeat}
              repeatLabel={t('parties.repeat')}
              micActive={toolbar.micActive}
              onToggleMic={toolbar.onToggleMic}
              micLabel={t('parties.voiceCommands')}
              micDisabled={toolbar.micDisabled}
            />
          )
          : null}
      {showBoard ? (
        <ChessBoardSection boardSize={boardSize}>
          <ChessBoard
            board={board}
            lastMove={lastMove}
            isFlipped={reader.boardFlipped}
            showCoordinates={showCoordinates}
            sizeMode="wide"
            size={boardSize}
            arrows={arrows}
            onSquarePress={onSquarePress}
            selectedSquare={selectedSquare}
            legalDots={legalDots}
          />
        </ChessBoardSection>
      ) : null}
      <Text
        style={[styles.progress, { color: colors.mutedForeground }]}
        testID="game-reader-progress"
      >
        {t('parties.progress', {
          label: reader.currentSan ?? '—',
          ply: reader.currentPly,
          total: reader.totalPly,
        })}
      </Text>
      <GameReaderNavControls
        canGoBack={reader.canGoBack}
        canGoForward={reader.canGoForward}
        onStart={reader.goToStart}
        onPrev={reader.goToPrevious}
        onNext={reader.goToNext}
        onEnd={reader.goToEnd}
        labels={{
          start: t('parties.start'),
          prev: t('parties.prev'),
          next: t('parties.next'),
          end: t('parties.end'),
        }}
      />
      {middleSlot}
      {comment ? (
        <Text
          style={[styles.comment, { color: colors.mutedForeground }]}
          testID="game-reader-comment"
        >
          {comment}
        </Text>
      ) : null}
    </View>
  );

  const notationColumn = showNotation ? (
    <View style={[styles.notationCol, split && styles.notationColDesktop]}>
      <GameReaderNotationList
        game={reader.game}
        currentNodeId={reader.currentNodeId}
        activeLineNodeIds={reader.activeLineNodeIds}
        onSelectNode={reader.goToNode}
        maxHeight={split ? Math.max(280, boardSize) : notationMaxHeight}
      />
      {bottomSlot}
    </View>
  ) : (
    bottomSlot
  );

  return (
    <View style={[styles.root, split && styles.rootSplit]} testID={testID}>
      {boardColumn}
      {notationColumn}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    gap: 10,
    alignItems: 'center',
  },
  rootSplit: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    maxWidth: 980,
    alignSelf: 'center',
    gap: 16,
  },
  boardCol: {
    width: '100%',
    maxWidth: 560,
    gap: 8,
    alignItems: 'center',
  },
  notationCol: {
    width: '100%',
    gap: 8,
  },
  notationColDesktop: {
    flex: 1,
    maxWidth: 360,
    minWidth: 240,
    paddingTop: 4,
  },
  progress: {
    fontSize: 13,
    fontFamily: DesignTokens.typography.weightSemiBold,
    textAlign: 'center',
  },
  comment: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
    width: '100%',
    textAlign: 'center',
  },
});
