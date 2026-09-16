/**
 * Compact icon toolbar above the board: flip / TTS / repeat / mic.
 * Max 4 actions; labels via accessibilityLabel (+ web title tooltip).
 */
import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { DesignTokens } from '@/constants/designTokens';

export type ReaderBoardToolbarProps = {
  flipped: boolean;
  onFlip: () => void;
  flipLabel: string;
  voiceActive: boolean;
  onToggleVoice: () => void;
  voiceLabel: string;
  onRepeat: () => void;
  repeatLabel: string;
  micActive: boolean;
  onToggleMic: () => void;
  micLabel: string;
  micDisabled?: boolean;
  testID?: string;
};

function ToolBtn({
  icon,
  label,
  onPress,
  active,
  disabled,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
  testID: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      testID={testID}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled), selected: Boolean(active) }}
      disabled={disabled}
      onPress={onPress}
      // @ts-expect-error web tooltip
      title={Platform.OS === 'web' ? label : undefined}
      hitSlop={6}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: active ? colors.primary : colors.card,
          borderColor: active ? colors.primary : colors.border,
          opacity: disabled ? 0.35 : pressed ? 0.75 : 1,
        },
      ]}
    >
      <Ionicons
        name={icon}
        size={20}
        color={active ? '#fff' : colors.foreground}
      />
    </Pressable>
  );
}

export function ReaderBoardToolbar({
  flipped,
  onFlip,
  flipLabel,
  voiceActive,
  onToggleVoice,
  voiceLabel,
  onRepeat,
  repeatLabel,
  micActive,
  onToggleMic,
  micLabel,
  micDisabled,
  testID = 'reader-board-toolbar',
}: ReaderBoardToolbarProps) {
  return (
    <View style={styles.wrap} testID={testID}>
      <ToolBtn
        icon="swap-vertical"
        label={flipLabel}
        onPress={onFlip}
        active={flipped}
        testID="reader-toolbar-flip"
      />
      <ToolBtn
        icon={voiceActive ? 'volume-high' : 'volume-mute'}
        label={voiceLabel}
        onPress={onToggleVoice}
        active={voiceActive}
        testID="reader-toolbar-voice"
      />
      <ToolBtn
        icon="repeat"
        label={repeatLabel}
        onPress={onRepeat}
        testID="reader-toolbar-repeat"
      />
      <ToolBtn
        icon={micActive ? 'mic' : 'mic-outline'}
        label={micLabel}
        onPress={onToggleMic}
        active={micActive}
        disabled={micDisabled}
        testID="reader-toolbar-mic"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
  },
  btn: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: DesignTokens.radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
});
