/**
 * Pressure gauge — green at 0.00 → red at −2.00 (player POV).
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatPlayerEval, gaugeFillRatio } from '../domain/EvaluationNormalizer.ts';
import { ENDGAME_TRAINING_CONFIG } from '../domain/types.ts';

type Props = {
  scoreCp: number;
  mateIn?: number | null;
  visible: boolean;
  testID?: string;
};

function colorForRatio(ratio: number): string {
  // ratio 1 = green (0.00), 0 = red (−2)
  if (ratio >= 0.75) return '#3d9a5c';
  if (ratio >= 0.5) return '#c4a035';
  if (ratio >= 0.25) return '#d4782e';
  return '#c44';
}

export function PressureGauge({ scoreCp, mateIn = null, visible, testID }: Props) {
  const ratio = useMemo(
    () =>
      gaugeFillRatio(
        scoreCp,
        ENDGAME_TRAINING_CONFIG.gaugeMinCp,
        ENDGAME_TRAINING_CONFIG.gaugeMaxCp,
      ),
    [scoreCp],
  );
  const color = colorForRatio(ratio);
  const label = formatPlayerEval(scoreCp, mateIn);

  if (!visible) return null;

  return (
    <View style={styles.wrap} testID={testID ?? 'endgame-pressure-gauge'}>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              width: `${Math.round(ratio * 100)}%`,
              backgroundColor: color,
            },
          ]}
        />
      </View>
      <Text style={[styles.value, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  track: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(128,128,128,0.25)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 5,
  },
  value: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
});
