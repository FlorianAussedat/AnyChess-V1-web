/**
 * Compact players / result strip for the shared game reader.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { DesignTokens } from '@/constants/designTokens';
import type { ReaderHeaders } from '@/lib/gameReader';

type Props = {
  headers: ReaderHeaders;
  whiteLabel: string;
  blackLabel: string;
  testID?: string;
};

function playerLine(name: string | undefined, elo: string | undefined, fallback: string) {
  const n = (name && name.trim()) || fallback;
  return elo && elo.trim() ? `${n} (${elo.trim()})` : n;
}

export function GameReaderPlayersBar({
  headers,
  whiteLabel,
  blackLabel,
  testID = 'game-reader-players',
}: Props) {
  const colors = useColors();
  const metaBits = [headers.event, headers.round, headers.date, headers.site].filter(
    (v): v is string => Boolean(v && v.trim()),
  );
  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.row}>
        <Text style={[styles.player, { color: colors.foreground }]} numberOfLines={1}>
          {playerLine(headers.white, headers.whiteElo, whiteLabel)}
        </Text>
        {headers.result ? (
          <Text style={[styles.result, { color: colors.primary }]}>{headers.result}</Text>
        ) : null}
        <Text
          style={[styles.player, styles.playerRight, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {playerLine(headers.black, headers.blackElo, blackLabel)}
        </Text>
      </View>
      {metaBits.length > 0 ? (
        <Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
          {metaBits.join(' · ')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  player: {
    flex: 1,
    fontSize: 14,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  playerRight: { textAlign: 'right' },
  result: {
    fontSize: 13,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  meta: { fontSize: 11, textAlign: 'center' },
});
