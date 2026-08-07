import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { useColors } from '@/hooks/useColors';
import { DesignTokens } from '@/constants/designTokens';

type Props = {
  /** Section label (e.g. Niveau adversaire / Vitesse de la voix). */
  label: string;
  /** Value shown prominently above the track. */
  valueLabel: string;
  minimumValue: number;
  maximumValue: number;
  step?: number;
  value: number;
  onValueChange: (value: number) => void;
  leftHint?: string;
  rightHint?: string;
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * Discrete AnyChess slider — same language as Blind « Vitesse (1–10) ».
 * Orange fill / blue remainder / round thumb.
 */
export function DiscreteSlider({
  label,
  valueLabel,
  minimumValue,
  maximumValue,
  step = 1,
  value,
  onValueChange,
  leftHint,
  rightHint,
  accessibilityLabel,
  testID,
}: Props) {
  const colors = useColors();
  return (
    <View style={styles.block} testID={testID}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={styles.valueRow}>
        {leftHint ? (
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>{leftHint}</Text>
        ) : (
          <View style={styles.hintSpacer} />
        )}
        <Text style={[styles.value, { color: colors.foreground }]}>{valueLabel}</Text>
        {rightHint ? (
          <Text style={[styles.hint, { color: colors.mutedForeground, textAlign: 'right' }]}>
            {rightHint}
          </Text>
        ) : (
          <View style={styles.hintSpacer} />
        )}
      </View>
      <Slider
        style={styles.slider}
        minimumValue={minimumValue}
        maximumValue={maximumValue}
        step={step}
        value={value}
        onValueChange={(v) => onValueChange(Math.round(v))}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.primary}
        accessibilityLabel={accessibilityLabel ?? label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: DesignTokens.spacing.sm },
  label: {
    fontSize: 11,
    fontFamily: DesignTokens.typography.weightSemiBold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  value: {
    fontSize: 15,
    fontFamily: DesignTokens.typography.weightSemiBold,
    textAlign: 'center',
    flex: 1,
  },
  hint: {
    width: 56,
    fontSize: 12,
    fontFamily: DesignTokens.typography.weightRegular,
  },
  hintSpacer: { width: 56 },
  slider: { width: '100%', height: 40 },
});
