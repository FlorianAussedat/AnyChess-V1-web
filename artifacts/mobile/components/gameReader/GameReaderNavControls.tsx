/**
 * Compact |<  <  >  >| navigation + flip for Lecteur / Analyseur.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { DesignTokens } from '@/constants/designTokens';

type Props = {
  canGoBack: boolean;
  canGoForward: boolean;
  onStart: () => void;
  onPrev: () => void;
  onNext: () => void;
  onEnd: () => void;
  onFlip?: () => void;
  labels: {
    start: string;
    prev: string;
    next: string;
    end: string;
    flip?: string;
  };
  testID?: string;
};

function NavBtn({
  icon,
  label,
  onPress,
  disabled,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      testID={testID}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: disabled ? 0.35 : pressed ? 0.75 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={22} color={colors.foreground} />
    </Pressable>
  );
}

export function GameReaderNavControls({
  canGoBack,
  canGoForward,
  onStart,
  onPrev,
  onNext,
  onEnd,
  onFlip,
  labels,
  testID = 'game-reader-nav',
}: Props) {
  return (
    <View style={styles.wrap} testID={testID}>
      <NavBtn
        icon="play-skip-back"
        label={labels.start}
        onPress={onStart}
        disabled={!canGoBack}
        testID="game-reader-nav-start"
      />
      <NavBtn
        icon="play-back"
        label={labels.prev}
        onPress={onPrev}
        disabled={!canGoBack}
        testID="game-reader-nav-prev"
      />
      <NavBtn
        icon="play-forward"
        label={labels.next}
        onPress={onNext}
        disabled={!canGoForward}
        testID="game-reader-nav-next"
      />
      <NavBtn
        icon="play-skip-forward"
        label={labels.end}
        onPress={onEnd}
        disabled={!canGoForward}
        testID="game-reader-nav-end"
      />
      {onFlip && labels.flip ? (
        <NavBtn
          icon="swap-vertical"
          label={labels.flip}
          onPress={onFlip}
          testID="game-reader-nav-flip"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    flexWrap: 'wrap',
    width: '100%',
  },
  btn: {
    minWidth: 48,
    minHeight: 48,
    borderRadius: DesignTokens.radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
});
