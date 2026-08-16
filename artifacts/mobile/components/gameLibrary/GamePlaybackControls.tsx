/**
 * Compact playback control row for Lecteur de parties.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { DesignTokens } from '@/constants/designTokens';

type Props = {
  isPlaying: boolean;
  onStart: () => void;
  onPrev: () => void;
  onTogglePlay: () => void;
  onNext: () => void;
  onEnd: () => void;
  onRepeat: () => void;
  labels: {
    start: string;
    prev: string;
    play: string;
    pause: string;
    next: string;
    end: string;
    repeat: string;
  };
};

function Ctrl({
  icon,
  label,
  onPress,
  testID,
  primary,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  testID: string;
  primary?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      testID={testID}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: primary ? colors.primary : colors.card,
          borderColor: primary ? colors.primary : colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Ionicons
        name={icon}
        size={primary ? 26 : 22}
        color={primary ? '#fff' : colors.foreground}
      />
    </Pressable>
  );
}

export function GamePlaybackControls({
  isPlaying,
  onStart,
  onPrev,
  onTogglePlay,
  onNext,
  onEnd,
  onRepeat,
  labels,
}: Props) {
  return (
    <View style={styles.wrap} testID="game-reader-controls">
      <Ctrl
        icon="play-skip-back"
        label={labels.start}
        onPress={onStart}
        testID="game-reader-start"
      />
      <Ctrl
        icon="play-back"
        label={labels.prev}
        onPress={onPrev}
        testID="game-reader-prev"
      />
      <Ctrl
        icon={isPlaying ? 'pause' : 'play'}
        label={isPlaying ? labels.pause : labels.play}
        onPress={onTogglePlay}
        testID="game-reader-play-pause"
        primary
      />
      <Ctrl
        icon="play-forward"
        label={labels.next}
        onPress={onNext}
        testID="game-reader-next"
      />
      <Ctrl
        icon="play-skip-forward"
        label={labels.end}
        onPress={onEnd}
        testID="game-reader-end"
      />
      <Pressable
        testID="game-reader-repeat"
        accessibilityLabel={labels.repeat}
        onPress={onRepeat}
        style={({ pressed }) => [styles.repeat, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Ionicons name="refresh" size={18} color="#9aa4b2" />
        <Text style={styles.repeatText}>{labels.repeat}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  btn: {
    width: 48,
    height: 48,
    borderRadius: DesignTokens.radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repeat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  repeatText: {
    color: '#9aa4b2',
    fontSize: 12,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
});
