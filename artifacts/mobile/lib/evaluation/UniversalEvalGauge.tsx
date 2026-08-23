/**
 * Universal evaluation gauge — reusable across defend draw, analysis, reader, classic.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  computeVisibleEval,
  gaugeFillRatioForBand,
  formatVisiblePawns,
  type EvalPerspective,
} from './visibleEval.ts';
import { ENDGAME_TRAINING_CONFIG } from '../endgameTraining/domain/types.ts';

export type UniversalEvalGaugeMode = 'pressure' | 'analysis';

type Props = {
  scoreCp: number;
  mateIn?: number | null;
  /** Whose POV positive = advantage. */
  perspective: EvalPerspective;
  sideToMove?: 'w' | 'b';
  /** When true, scoreCp is already perspective-normalized. */
  scoreIsPerspectivePov?: boolean;
  visible?: boolean;
  mode?: UniversalEvalGaugeMode;
  testID?: string;
};

function colorForRatio(ratio: number): string {
  if (ratio >= 0.75) return '#3d9a5c';
  if (ratio >= 0.5) return '#c4a035';
  if (ratio >= 0.25) return '#d4782e';
  return '#c44';
}

function colorForAnalysis(pawns: number): string {
  if (pawns >= 2) return '#3d9a5c';
  if (pawns >= 0.5) return '#6a9a5c';
  if (pawns <= -2) return '#c44';
  if (pawns <= -0.5) return '#d4782e';
  return '#c4a035';
}

export function UniversalEvalGauge({
  scoreCp,
  mateIn = null,
  perspective,
  sideToMove,
  scoreIsPerspectivePov = true,
  visible = true,
  mode = 'analysis',
  testID,
}: Props) {
  const evalData = useMemo(
    () =>
      computeVisibleEval({
        scoreCp,
        mateIn,
        perspective,
        sideToMove,
        scoreIsPerspectivePov,
      }),
    [scoreCp, mateIn, perspective, sideToMove, scoreIsPerspectivePov],
  );

  const ratio = useMemo(() => {
    if (mode === 'pressure') {
      return gaugeFillRatioForBand(
        evalData.rawPerspectiveCp,
        ENDGAME_TRAINING_CONFIG.gaugeMinCp,
        ENDGAME_TRAINING_CONFIG.gaugeMaxCp,
      );
    }
    return gaugeFillRatioForBand(
      evalData.visibleCp,
      -1000,
      1000,
    );
  }, [evalData, mode]);

  const label = evalData.mateLabel ?? formatVisiblePawns(evalData.visiblePawns);
  const color =
    mode === 'pressure'
      ? colorForRatio(ratio)
      : colorForAnalysis(evalData.visiblePawns);

  if (!visible) return null;

  return (
    <View style={styles.wrap} testID={testID ?? 'universal-eval-gauge'}>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              width: `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`,
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
