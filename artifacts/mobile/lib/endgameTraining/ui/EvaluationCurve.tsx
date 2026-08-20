/**
 * Simple evaluation curve for result / analysis screens.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Line, Circle } from 'react-native-svg';
import type { EvaluationPoint, FirstMajorTurn } from '../domain/types.ts';
import { ENDGAME_TRAINING_CONFIG } from '../domain/types.ts';

type Props = {
  timeline: EvaluationPoint[];
  firstMajorTurn?: FirstMajorTurn | null;
  width?: number;
  height?: number;
  testID?: string;
};

export function EvaluationCurve({
  timeline,
  firstMajorTurn = null,
  width = 320,
  height = 120,
  testID,
}: Props) {
  const { points, thresholdY, turnPoint } = useMemo(() => {
    const min = ENDGAME_TRAINING_CONFIG.gaugeMinCp - 50;
    const max = 50;
    const pad = 8;
    const usableW = width - pad * 2;
    const usableH = height - pad * 2;
    const n = Math.max(1, timeline.length - 1);
    const toY = (cp: number) => {
      const clamped = Math.max(min, Math.min(max, cp));
      const t = (clamped - min) / (max - min);
      return pad + (1 - t) * usableH;
    };
    const pts = timeline.map((p, i) => {
      const x = pad + (i / n) * usableW;
      const y = toY(p.scoreCp);
      return `${x},${y}`;
    });
    const thrY = toY(ENDGAME_TRAINING_CONFIG.lossThresholdCp);
    let turn: { x: number; y: number } | null = null;
    if (firstMajorTurn) {
      const idx = timeline.findIndex(
        (p) => p.playerMoveNumber === firstMajorTurn.playerMoveNumber,
      );
      if (idx >= 0) {
        const x = pad + (idx / n) * usableW;
        turn = { x, y: toY(timeline[idx]!.scoreCp) };
      }
    }
    return { points: pts.join(' '), thresholdY: thrY, turnPoint: turn };
  }, [timeline, firstMajorTurn, width, height]);

  if (timeline.length < 2) {
    return (
      <Text style={styles.empty} testID={testID}>
        Pas assez de points pour la courbe.
      </Text>
    );
  }

  return (
    <View testID={testID ?? 'endgame-eval-curve'}>
      <Svg width={width} height={height}>
        <Line
          x1={8}
          x2={width - 8}
          y1={thresholdY}
          y2={thresholdY}
          stroke="#c44"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <Polyline
          points={points}
          fill="none"
          stroke="#4a9eff"
          strokeWidth={2}
        />
        {turnPoint && (
          <Circle cx={turnPoint.x} cy={turnPoint.y} r={5} fill="#c44" />
        )}
      </Svg>
      <Text style={styles.caption}>Limite −2.00</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { fontSize: 12, opacity: 0.7, fontFamily: 'Inter_400Regular' },
  caption: {
    fontSize: 11,
    opacity: 0.6,
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
  },
});
