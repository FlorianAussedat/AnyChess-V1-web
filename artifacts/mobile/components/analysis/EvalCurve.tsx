import React, { useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { DesignTokens } from '@/constants/designTokens';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import {
  clampEvalForCurve,
  formatAnyLyseurEval,
  type GameNodeAnalysis,
} from '@/lib/analysis';

export type EvalCurvePoint = {
  nodeId: string;
  analysis: GameNodeAnalysis;
};

type Props = {
  points: EvalCurvePoint[];
  activeNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  height?: number;
  testID?: string;
};

export function EvalCurve({
  points,
  activeNodeId,
  onSelectNode,
  height = 88,
  testID = 'anyliseur-eval-curve',
}: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);

  const coords = useMemo(() => {
    if (points.length === 0 || width <= 0) return [];
    const maxPawns = 8;
    return points.map((p, i) => {
      const x =
        points.length === 1
          ? width / 2
          : (i / (points.length - 1)) * Math.max(1, width - 8) + 4;
      const v = clampEvalForCurve(
        { cp: p.analysis.evaluation, mate: p.analysis.mate },
        maxPawns,
      );
      const y = height / 2 - (v / maxPawns) * ((height - 12) / 2);
      return { ...p, x, y };
    });
  }, [points, width, height]);

  const active = coords.find((c) => c.nodeId === activeNodeId) ?? null;

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      testID={testID}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>
        {t('parties.anyliseurCurve')}
      </Text>
      <View style={{ height, width: '100%' }}>
        <View
          style={[
            styles.mid,
            { top: height / 2, backgroundColor: colors.border },
          ]}
        />
        {coords.map((c, i) => {
          if (i === 0) return null;
          const prev = coords[i - 1]!;
          const dx = c.x - prev.x;
          const dy = c.y - prev.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 0;
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          return (
            <View
              key={`seg-${c.nodeId}`}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: prev.x,
                top: prev.y,
                width: len,
                height: 2,
                backgroundColor: colors.primary,
                transform: [{ translateY: -1 }, { rotate: `${angle}deg` }],
              }}
            />
          );
        })}
        {coords.map((c) => {
          const selected = c.nodeId === activeNodeId;
          return (
            <Pressable
              key={c.nodeId}
              testID={`${testID}-point-${c.nodeId}`}
              onPress={() => onSelectNode(c.nodeId)}
              hitSlop={8}
              style={{
                position: 'absolute',
                left: c.x - (selected ? 5 : 4),
                top: c.y - (selected ? 5 : 4),
                width: selected ? 10 : 8,
                height: selected ? 10 : 8,
                borderRadius: 8,
                backgroundColor: selected ? colors.primary : colors.foreground,
                borderWidth: selected ? 2 : 0,
                borderColor: colors.background,
              }}
            />
          );
        })}
      </View>
      {active ? (
        <Text style={[styles.active, { color: colors.mutedForeground }]}>
          {formatAnyLyseurEval({
            cp: active.analysis.evaluation,
            mate: active.analysis.mate,
          })}
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
  },
  title: {
    fontSize: DesignTokens.typography.body,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  mid: { position: 'absolute', left: 0, right: 0, height: 1 },
  active: {
    fontSize: 12,
    textAlign: 'center',
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
});
