import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Chess } from 'chess.js';
import { ChessBoard } from '@/components/ChessBoard';
import type { BoardPiece } from '@/lib/game/types';
import { campFromSquareTap, CAMP_PICKER_START_FEN } from '@/lib/game/boardCampPicker';
import { campZoneRects } from '@/lib/game/campZoneRects';
import type { BoardSizeMode, SideChoice } from '@/lib/game';
import { useBoardSize } from '@/hooks/useBoardSize';
import { useColors } from '@/hooks/useColors';
import { DesignTokens } from '@/constants/designTokens';

type Props = {
  onSelect: (side: SideChoice) => void;
  /** Preview orientation while choosing (default White at bottom). */
  isFlipped?: boolean;
  /** Match ChessBoard footprint (Classic uses `wide`). */
  sizeMode?: BoardSizeMode;
};

/**
 * Pre-game camp selector: tap White/Black pieces on the starting board,
 * or the discreet central « Camp aléatoire » button.
 */
export function BoardCampPicker({
  onSelect,
  isFlipped = false,
  sizeMode = 'default',
}: Props) {
  const colors = useColors();
  const boardSize = useBoardSize(sizeMode);
  const zones = useMemo(() => campZoneRects(boardSize, isFlipped), [boardSize, isFlipped]);

  const board = useMemo(
    () => new Chess(CAMP_PICKER_START_FEN).board() as (BoardPiece | null)[][],
    [],
  );

  return (
    <View style={styles.wrap} testID="board-camp-picker">
      <Text style={[styles.heading, { color: colors.mutedForeground }]}>CHOIX DU CAMP</Text>
      <View style={[styles.boardHost, { width: boardSize, height: boardSize }]}>
        <ChessBoard
          board={board}
          lastMove={null}
          isFlipped={isFlipped}
          showCoordinates
          sizeMode={sizeMode}
          size={boardSize}
          onSquarePress={(square) => {
            const camp = campFromSquareTap(board, square);
            if (camp) onSelect(camp);
          }}
        />
        <View
          testID="camp-zone-black"
          pointerEvents="none"
          style={[
            styles.zone,
            {
              top: zones.black.top,
              left: zones.black.left,
              width: zones.black.width,
              height: zones.black.height,
              borderColor: colors.primary,
            },
          ]}
        />
        <View
          testID="camp-zone-white"
          pointerEvents="none"
          style={[
            styles.zone,
            {
              top: zones.white.top,
              left: zones.white.left,
              width: zones.white.width,
              height: zones.white.height,
              borderColor: colors.primary,
            },
          ]}
        />
        <View style={styles.overlay} pointerEvents="box-none">
          <Pressable
            testID="camp-random"
            accessibilityRole="button"
            accessibilityLabel="Camp aléatoire"
            onPress={() => onSelect('random')}
            style={({ pressed }) => [
              styles.randomBtn,
              {
                backgroundColor: colors.card,
                borderColor: colors.primary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={[styles.randomLine, { color: colors.primary }]}>Camp</Text>
            <Text style={[styles.randomLine, { color: colors.primary }]}>aléatoire</Text>
          </Pressable>
        </View>
      </View>
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>
        Touche les pièces Blanches ou Noires, ou choisis un camp aléatoire.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: DesignTokens.spacing.sm, alignItems: 'center' },
  heading: {
    alignSelf: 'stretch',
    fontSize: 11,
    fontFamily: DesignTokens.typography.weightSemiBold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  boardHost: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  zone: {
    position: 'absolute',
    borderWidth: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(245, 166, 35, 0.2)',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  randomBtn: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  randomLine: {
    fontSize: 12,
    fontFamily: DesignTokens.typography.weightBold,
    textAlign: 'center',
    lineHeight: 15,
  },
  hint: {
    fontSize: 12,
    fontFamily: DesignTokens.typography.weightRegular,
    textAlign: 'center',
    lineHeight: 17,
  },
});
