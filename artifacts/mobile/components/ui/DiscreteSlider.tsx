import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { snapDiscreteValue } from '@/lib/preferences/discreteValue';
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
  const { t } = useTranslation();
  const selected = snapDiscreteValue(value, minimumValue, maximumValue, step);
  const change = (next: number) => {
    if (Number.isFinite(next))
      onValueChange(snapDiscreteValue(next, minimumValue, maximumValue, step));
  };
  const adjust = (direction: number) => change(selected + direction * step);

  return (
    <View style={styles.block} testID={testID}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <View style={styles.valueRow}>
        {leftHint ? (
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            {leftHint}
          </Text>
        ) : (
          <View style={styles.hintSpacer} />
        )}
        <Text style={[styles.value, { color: colors.foreground }]}>
          {valueLabel}
        </Text>
        {rightHint ? (
          <Text
            style={[
              styles.hint,
              { color: colors.mutedForeground, textAlign: 'right' },
            ]}
          >
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
        value={selected}
        onValueChange={change}
        {...(Platform.OS === 'web'
          ? {
              onKeyDown: (event: {
                key: string;
                preventDefault: () => void;
              }) => {
                if (event.key === 'Home') change(minimumValue);
                else if (event.key === 'End') change(maximumValue);
                else if (event.key === 'ArrowRight' || event.key === 'ArrowUp')
                  adjust(1);
                else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown')
                  adjust(-1);
                else return;
                event.preventDefault();
              },
              tabIndex: 0,
            }
          : {})}
        accessibilityRole="adjustable"
        accessibilityValue={{
          min: minimumValue,
          max: maximumValue,
          now: selected,
          text: valueLabel,
        }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={({ nativeEvent }) => {
          if (nativeEvent.actionName === 'increment') adjust(1);
          if (nativeEvent.actionName === 'decrement') adjust(-1);
        }}
        testID={testID ? `${testID}-track` : undefined}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.primary}
        accessibilityLabel={accessibilityLabel ?? label}
      />
      <View style={styles.controls}>
        {([-1, 1] as const).map((direction) => (
          <Pressable
            key={direction}
            accessibilityRole="button"
            accessibilityLabel={`${t(direction < 0 ? 'settings.levelDecrease' : 'settings.levelIncrease')} — ${label}`}
            disabled={
              direction < 0
                ? selected <= minimumValue
                : selected >= maximumValue
            }
            onPress={() => adjust(direction)}
            testID={
              testID
                ? `${testID}-${direction < 0 ? 'decrease' : 'increase'}`
                : undefined
            }
            style={({ pressed }) => [
              styles.control,
              { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={{ color: colors.primary, fontSize: 22 }}>
              {direction < 0 ? '−' : '+'}
            </Text>
          </Pressable>
        ))}
      </View>
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
  slider: { width: '100%', height: DesignTokens.minTouchTarget },
  controls: { flexDirection: 'row', justifyContent: 'space-between' },
  control: {
    minWidth: DesignTokens.minTouchTarget,
    minHeight: DesignTokens.minTouchTarget,
    borderWidth: 1,
    borderRadius: DesignTokens.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
