import React, { useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { DesignTokens } from '@/constants/designTokens';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import {
  hitTestCurve,
  layoutEvalCurve,
} from '@/lib/analysis/evalCurveLayout.ts';
import type { GameNodeAnalysis } from '@/lib/analysis/types.ts';

export type EvalCurvePoint = {
  nodeId: string;
  analysis: GameNodeAnalysis | null;
  fen?: string;
  moveNumber?: number | null;
  plyColor?: 'w' | 'b' | null;
};

type Props = {
  points: EvalCurvePoint[];
  activeNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  height?: number;
  /** Used before the first layout, and in tests. */
  layoutWidth?: number;
  testID?: string;
};

export function EvalCurve({
  points,
  activeNodeId,
  onSelectNode,
  height = 96,
  layoutWidth = 0,
  testID = 'anyliseur-eval-curve',
}: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const [width, setWidth] = useState(layoutWidth);

  const layout = useMemo(
    () =>
      layoutEvalCurve(
        points.map((point) => ({
          id: point.nodeId,
          fen: point.fen ?? point.analysis?.fen ?? '',
          moveNumber: point.moveNumber ?? null,
          plyColor: point.plyColor ?? null,
          evaluation: point.analysis?.evaluation ?? null,
          mate: point.analysis?.mate ?? null,
          terminalOutcome: point.analysis?.terminalOutcome,
        })),
        width,
        height,
      ),
    [points, width, height],
  );

  const active =
    layout.points.find((point) => point.id === activeNodeId) ?? null;

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      testID={testID}
      onLayout={(event: LayoutChangeEvent) => {
        const next = event.nativeEvent.layout.width;
        if (next > 0 && next !== width) setWidth(next);
      }}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>
        {t('parties.anyliseurCurve')}
      </Text>
      <View style={[styles.plot, { height }]} testID={`${testID}-plot`}>
        <View
          pointerEvents="none"
          style={[
            styles.mid,
            { top: layout.equalityY, backgroundColor: colors.border },
          ]}
        />
        {width > 0 ? (
          <Svg
            pointerEvents="none"
            width={width}
            height={height}
            style={StyleSheet.absoluteFill}
          >
            {layout.segments.map((segment) => (
              <Line
                key={`seg-${segment.x1}-${segment.y1}-${segment.x2}-${segment.y2}`}
                x1={segment.x1}
                y1={segment.y1}
                x2={segment.x2}
                y2={segment.y2}
                stroke={colors.primary}
                strokeWidth={2}
              />
            ))}
          </Svg>
        ) : null}
        {layout.ticks.map((tick) => (
          <Text
            key={`tick-${tick.label}-${tick.x}`}
            pointerEvents="none"
            style={[
              styles.tick,
              {
                left: Math.max(0, tick.x - 10),
                color: colors.mutedForeground,
              },
            ]}
          >
            {tick.label}
          </Text>
        ))}
        {active && active.y != null ? (
          <View
            pointerEvents="none"
            testID={`${testID}-point-${active.id}`}
            style={{
              position: 'absolute',
              left: active.x - 5,
              top: active.y - 5,
              width: 10,
              height: 10,
              borderRadius: 8,
              backgroundColor: colors.primary,
              borderWidth: 2,
              borderColor: colors.background,
            }}
          />
        ) : null}
        <Pressable
          testID={`${testID}-hit`}
          accessibilityRole="button"
          accessibilityLabel={t('parties.anyliseurCurve')}
          style={StyleSheet.absoluteFill}
          onPress={(event) => {
            const x = event.nativeEvent?.locationX;
            if (typeof x !== 'number') return;
            const id = hitTestCurve(layout, x);
            if (id) onSelectNode(id);
          }}
        />
      </View>
      <Text
        style={[styles.active, { color: colors.mutedForeground }]}
        testID={`${testID}-value`}
      >
        {active?.exactLabel ??
          (active ? t('parties.anyliseurEvalMissing') : '')}
      </Text>
      {layout.scaleCapped ? (
        <Text
          style={[styles.cap, { color: colors.mutedForeground }]}
          testID={`${testID}-scale`}
        >
          {t('parties.anyliseurScaleCapped')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderWidth: 1,
    borderRadius: DesignTokens.radius.md,
    padding: DesignTokens.spacing.md,
    gap: 6,
    overflow: 'hidden',
  },
  title: {
    fontSize: DesignTokens.typography.body,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  plot: { width: '100%', overflow: 'hidden' },
  mid: { position: 'absolute', left: 12, right: 12, height: 1 },
  tick: {
    position: 'absolute',
    bottom: 0,
    width: 20,
    textAlign: 'center',
    fontSize: 9,
  },
  active: {
    fontSize: 12,
    textAlign: 'center',
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  cap: { fontSize: 10, textAlign: 'center' },
});
