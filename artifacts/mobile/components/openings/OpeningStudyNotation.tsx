import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { usePreferences } from '@/hooks/usePreferences';
import { formatSanForDisplay } from '@/lib/chess/notation';
import { formatNags } from '@/lib/openingStudy';
import { flattenNotationTree } from '@/components/gameReader/GameReaderNotationList';
import type { ReaderGame } from '@/lib/gameReader';
import { DesignTokens } from '@/constants/designTokens';

type Props = {
  game: ReaderGame;
  currentNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
};

export function OpeningStudyNotation({ game, currentNodeId, onSelectNode }: Props) {
  const colors = useColors();
  const { chessNotation } = usePreferences();
  const entries = useMemo(() => flattenNotationTree(game), [game]);

  return (
    <ScrollView style={styles.list} testID="opening-study-notation">
      <View style={styles.wrap}>
        {entries.map((entry) => {
          const node = game.nodesById[entry.nodeId];
          const active = entry.nodeId === currentNodeId;
          const prefix = entry.prefix ?? '';
          const nags = formatNags(node?.nags);
          return (
            <Pressable
              key={entry.key}
              onPress={() => onSelectNode(entry.nodeId)}
              style={[
                styles.move,
                active && { backgroundColor: colors.primary },
              ]}
            >
              <Text
                style={[
                  styles.text,
                  {
                    color: active ? colors.primaryForeground : colors.foreground,
                    fontFamily: entry.depth > 0 ? 'Inter_400Regular' : 'Inter_600SemiBold',
                  },
                ]}
              >
                {prefix}
                {formatSanForDisplay(entry.san, chessNotation)}
                {nags}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { maxHeight: 220 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, paddingBottom: 8 },
  move: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  text: { fontSize: 14, fontFamily: DesignTokens.typography.weightRegular },
});
