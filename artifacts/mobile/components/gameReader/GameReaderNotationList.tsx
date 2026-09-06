/**
 * Clickable move notation with smart auto-scroll for Lecteur / Analyseur.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { usePreferences } from '@/hooks/usePreferences';
import { DesignTokens } from '@/constants/designTokens';
import { formatSanForDisplay } from '@/lib/chess/notation';
import { groupOpeningSans } from '@/lib/openingQuiz/groupOpeningSans';

type Props = {
  sans: readonly string[];
  currentPly: number;
  onSelectPly: (ply: number) => void;
  maxHeight?: number;
  testID?: string;
};

const ROW_H = 30;

export function GameReaderNotationList({
  sans,
  currentPly,
  onSelectPly,
  maxHeight = 220,
  testID = 'game-reader-notation',
}: Props) {
  const colors = useColors();
  const { chessNotation } = usePreferences();
  const scrollRef = useRef<ScrollView>(null);
  const lastAutoPly = useRef<number | null>(null);

  const displaySans = useMemo(
    () => sans.map((san) => formatSanForDisplay(san, chessNotation)),
    [sans, chessNotation],
  );
  const rows = useMemo(() => groupOpeningSans(displaySans), [displaySans]);

  useEffect(() => {
    if (currentPly <= 0 || rows.length === 0) return;
    if (lastAutoPly.current === currentPly) return;
    lastAutoPly.current = currentPly;
    const rowIndex = Math.max(0, Math.ceil(currentPly / 2) - 1);
    const y = Math.max(0, rowIndex * ROW_H - Math.floor(maxHeight / 3));
    scrollRef.current?.scrollTo({ y, animated: true });
  }, [currentPly, rows.length, maxHeight]);

  if (rows.length === 0) return null;

  return (
    <ScrollView
      ref={scrollRef}
      style={[styles.scroll, { maxHeight }]}
      contentContainerStyle={styles.content}
      testID={testID}
      nestedScrollEnabled
    >
      {rows.map((row) => {
        const whitePly = row.moveNumber * 2 - 1;
        const blackPly = row.moveNumber * 2;
        const whiteActive = currentPly === whitePly;
        const blackActive = currentPly === blackPly;
        return (
          <View key={row.moveNumber} style={[styles.row, { minHeight: ROW_H }]}>
            <Text style={[styles.num, { color: colors.mutedForeground }]}>
              {row.moveNumber}.
            </Text>
            {row.white ? (
              <Pressable
                testID={`game-reader-ply-${whitePly}`}
                accessibilityRole="button"
                onPress={() => onSelectPly(whitePly)}
                style={[
                  styles.sanBtn,
                  whiteActive && { backgroundColor: 'rgba(57, 138, 85, 0.28)' },
                ]}
              >
                <Text
                  style={[
                    styles.san,
                    { color: whiteActive ? colors.primary : colors.foreground },
                  ]}
                >
                  {row.white}
                </Text>
              </Pressable>
            ) : (
              <View style={styles.sanBtn} />
            )}
            {row.black ? (
              <Pressable
                testID={`game-reader-ply-${blackPly}`}
                accessibilityRole="button"
                onPress={() => onSelectPly(blackPly)}
                style={[
                  styles.sanBtn,
                  blackActive && { backgroundColor: 'rgba(57, 138, 85, 0.28)' },
                ]}
              >
                <Text
                  style={[
                    styles.san,
                    { color: blackActive ? colors.primary : colors.foreground },
                  ]}
                >
                  {row.black}
                </Text>
              </Pressable>
            ) : (
              <View style={styles.sanBtn} />
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { width: '100%' },
  content: { gap: 2, paddingVertical: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.spacing.sm,
  },
  num: {
    width: 28,
    fontSize: 14,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  sanBtn: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: DesignTokens.radius.sm,
  },
  san: {
    fontSize: 15,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
});
