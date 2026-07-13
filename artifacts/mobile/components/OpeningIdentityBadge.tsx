import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import type { OpeningIdentity } from '@/lib/openings';

interface Props {
  opening: OpeningIdentity | null;
}

/** Discreet visual-only opening name + ECO (no TTS, no buttons). */
export function OpeningIdentityBadge({ opening }: Props) {
  const colors = useColors();
  if (!opening) return null;

  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={2}>
        {opening.name}
      </Text>
      <Text style={[styles.eco, { color: colors.mutedForeground }]}>ECO {opening.eco}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 1, paddingVertical: 2 },
  name: { fontSize: 12, fontFamily: 'Inter_500Medium', lineHeight: 16 },
  eco: { fontSize: 11, fontFamily: 'Inter_400Regular' },
});
