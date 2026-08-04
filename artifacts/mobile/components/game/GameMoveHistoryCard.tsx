import React, { useEffect, useRef } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OpeningIdentityBadge } from '@/components/OpeningIdentityBadge';
import { useColors } from '@/hooks/useColors';
import type { MoveRow } from '@/lib/game/types';
import type { OpeningIdentity } from '@/lib/openings';

type Props = {
  moveRows: MoveRow[];
  opening: OpeningIdentity | null;
  emptyMessage: string;
  onExportPress?: () => void;
  /** Classic uses icon; Openings uses text link. */
  exportMode?: 'icon' | 'text';
};

export function GameMoveHistoryCard({
  moveRows,
  opening,
  emptyMessage,
  onExportPress,
  exportMode = 'icon',
}: Props) {
  const colors = useColors();
  const historyListRef = useRef<FlatList<MoveRow>>(null);

  useEffect(() => {
    if (moveRows.length > 0) {
      setTimeout(() => historyListRef.current?.scrollToEnd({ animated: true }), 60);
    }
  }, [moveRows.length]);

  return (
    <View
      style={[styles.historyCard, { flex: 1, backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={styles.historyHeader}>
        <View style={{ flex: 1, gap: 2, paddingRight: 8 }}>
          <Text style={[styles.historyTitle, { color: colors.mutedForeground }]}>Coups joués</Text>
          <OpeningIdentityBadge opening={opening} />
        </View>
        {moveRows.length > 0 && onExportPress ? (
          exportMode === 'text' ? (
            <Pressable onPress={onExportPress} hitSlop={8}>
              <Text style={{ color: colors.primary, fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>
                Exporter
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={onExportPress}
              hitSlop={8}
              accessibilityLabel="Exporter en PGN"
              style={({ pressed }) => [
                styles.exportIconBtn,
                { borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Ionicons name="download-outline" size={16} color={colors.foreground} />
            </Pressable>
          )
        ) : null}
      </View>
      {moveRows.length === 0 ? (
        <Text style={[styles.emptyMsg, { color: colors.mutedForeground }]}>{emptyMessage}</Text>
      ) : (
        <FlatList
          ref={historyListRef}
          data={moveRows}
          keyExtractor={(item) => item.key}
          scrollEnabled
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={[styles.moveRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.moveNum, { color: colors.mutedForeground }]}>{item.num}.</Text>
              <Text style={[styles.moveCell, { color: colors.foreground }]}>{item.white}</Text>
              <Text style={[styles.moveCell, { color: colors.mutedForeground }]}>{item.black}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  historyCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
    minHeight: 80,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  historyTitle: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  exportIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyMsg: { fontSize: 13, fontFamily: 'Inter_400Regular', paddingVertical: 8 },
  moveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  moveNum: { width: 28, fontSize: 12, fontFamily: 'Inter_500Medium' },
  moveCell: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium' },
});
