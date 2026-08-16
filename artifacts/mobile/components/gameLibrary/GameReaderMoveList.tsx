/**
 * Tappable move list for Game Reader — highlights current ply.
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
  /** Current ply cursor (0 = before first move). */
  currentPly: number;
  onSelectPly: (ply: number) => void;
  testID?: string;
};

export function GameReaderMoveList({
  sans,
  currentPly,
  onSelectPly,
  testID = 'game-reader-moves',
}: Props) {
  const colors = useColors();
  const { chessNotation } = usePreferences();
  const scrollRef = useRef<ScrollView>(null);

  const displaySans = useMemo(
    () => sans.map((san) => formatSanForDisplay(san, chessNotation)),
    [sans, chessNotation],
  );
  const rows = useMemo(() => groupOpeningSans(displaySans), [displaySans]);

  useEffect(() => {
    if (currentPly <= 0) return;
    const rowIndex = Math.max(0, Math.ceil(currentPly / 2) - 1);
    scrollRef.current?.scrollTo({ y: Math.max(0, rowIndex * 32 - 40), animated: true });
  }, [currentPly]);

  if (rows.length === 0) return null;

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
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
          <View key={row.moveNumber} style={styles.row}>
            <Text style={[styles.num, { color: colors.mutedForeground }]}>
              {row.moveNumber}.
            </Text>
            {row.white ? (
              <Pressable
                testID={`game-reader-ply-${whitePly}`}
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
  scroll: { maxHeight: 220, width: '100%' },
  content: { gap: 4, paddingVertical: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.spacing.sm,
    minHeight: 28,
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
