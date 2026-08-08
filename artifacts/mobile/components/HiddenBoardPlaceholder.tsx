import React from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { BrandAssets } from '@/constants/BrandAssets';
import { computeBoardSize, type BoardSizeMode } from '@/lib/game/boardSize';

interface Props {
  onReveal?: () => void;
  /** Match ChessBoard footprint (default = compact historical size). */
  sizeMode?: BoardSizeMode;
  /** Optional explicit edge length (overrides sizeMode). */
  size?: number;
}

/**
 * Shown in place of the chessboard when the eye toggle hides it.
 *
 * Occupies the same footprint as the board so the layout does not jump, and
 * makes clear the game is still running — only the visual board is hidden.
 */
export function HiddenBoardPlaceholder({
  onReveal,
  sizeMode = 'default',
  size,
}: Props) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const edge = size ?? computeBoardSize(width, sizeMode);

  return (
    <View
      style={[
        styles.wrapper,
        { width: edge, height: edge, backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Image
        source={BrandAssets.toggles.boardOff}
        style={styles.boardIcon}
        resizeMode="contain"
        accessibilityLabel="Échiquier masqué"
      />
      <Text style={[styles.title, { color: colors.foreground }]}>Échiquier masqué</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        La partie continue normalement.
      </Text>
      {onReveal && (
        <Pressable
          onPress={onReveal}
          style={({ pressed }) => [
            styles.revealBtn,
            { borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Image
            source={BrandAssets.toggles.boardOn}
            style={styles.revealIcon}
            resizeMode="contain"
          />
          <Text style={[styles.revealLabel, { color: colors.foreground }]}>Afficher</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  boardIcon: {
    width: 72,
    height: 72,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  revealBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
  },
  revealIcon: {
    width: 18,
    height: 18,
  },
  revealLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
});
