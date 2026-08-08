/**
 * Chess move keypad V3 — Classic Mode opt-in.
 * Auto-submits form-complete moves; validation stays in applyUserMove.
 */
import React, { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { DesignTokens } from '@/constants/designTokens';
import {
  MOVE_KEYPAD_A11Y,
  applyMoveKeypadToken,
  backspaceMoveKeypad,
  clearMoveKeypad,
  priorityMoveKeypadKeys,
  type MoveKeypadInsertToken,
} from '@/lib/moveInput/chessMoveKeypad';

type Props = {
  value: string;
  onChangeText: (next: string) => void;
  /**
   * Called with the completed buffer (auto-submit) — same validation path
   * as text/voice submit. Parent clears on success.
   */
  onSubmit: (raw: string) => void;
  /** When true (default), submit as soon as the buffer is form-complete. */
  autoSubmit?: boolean;
  enabled?: boolean;
  compact?: boolean;
  testID?: string;
};

type KeyDef = {
  id: string;
  label: string;
  token?: MoveKeypadInsertToken;
  action?: 'backspace' | 'clear';
  flex?: number;
  a11y: string;
};

const ROWS: KeyDef[][] = [
  [
    { id: 'C', label: 'C', token: 'C', a11y: MOVE_KEYPAD_A11Y.C },
    { id: 'a', label: 'a', token: 'a', a11y: MOVE_KEYPAD_A11Y.a },
    { id: 'b', label: 'b', token: 'b', a11y: MOVE_KEYPAD_A11Y.b },
    { id: '1', label: '1', token: '1', a11y: MOVE_KEYPAD_A11Y['1'] },
    { id: '2', label: '2', token: '2', a11y: MOVE_KEYPAD_A11Y['2'] },
    { id: 'x', label: 'x', token: 'x', a11y: MOVE_KEYPAD_A11Y.x },
  ],
  [
    { id: 'F', label: 'F', token: 'F', a11y: MOVE_KEYPAD_A11Y.F },
    { id: 'c', label: 'c', token: 'c', a11y: MOVE_KEYPAD_A11Y.c },
    { id: 'd', label: 'd', token: 'd', a11y: MOVE_KEYPAD_A11Y.d },
    { id: '3', label: '3', token: '3', a11y: MOVE_KEYPAD_A11Y['3'] },
    { id: '4', label: '4', token: '4', a11y: MOVE_KEYPAD_A11Y['4'] },
    { id: 'backspace', label: '⌫', action: 'backspace', a11y: MOVE_KEYPAD_A11Y.backspace },
  ],
  [
    { id: 'T', label: 'T', token: 'T', a11y: MOVE_KEYPAD_A11Y.T },
    { id: 'e', label: 'e', token: 'e', a11y: MOVE_KEYPAD_A11Y.e },
    { id: 'f', label: 'f', token: 'f', a11y: MOVE_KEYPAD_A11Y.f },
    { id: '5', label: '5', token: '5', a11y: MOVE_KEYPAD_A11Y['5'] },
    { id: '6', label: '6', token: '6', a11y: MOVE_KEYPAD_A11Y['6'] },
    { id: 'clear', label: 'Eff', action: 'clear', a11y: MOVE_KEYPAD_A11Y.clear },
  ],
  [
    { id: 'D', label: 'D', token: 'D', a11y: MOVE_KEYPAD_A11Y.D },
    { id: 'g', label: 'g', token: 'g', a11y: MOVE_KEYPAD_A11Y.g },
    { id: 'h', label: 'h', token: 'h', a11y: MOVE_KEYPAD_A11Y.h },
    { id: '7', label: '7', token: '7', a11y: MOVE_KEYPAD_A11Y['7'] },
    { id: '8', label: '8', token: '8', a11y: MOVE_KEYPAD_A11Y['8'] },
    { id: 'R', label: 'R', token: 'R', a11y: MOVE_KEYPAD_A11Y.R },
  ],
  [
    { id: 'O-O', label: 'O-O', token: 'O-O', flex: 1, a11y: MOVE_KEYPAD_A11Y['O-O'] },
    { id: 'O-O-O', label: 'O-O-O', token: 'O-O-O', flex: 1, a11y: MOVE_KEYPAD_A11Y['O-O-O'] },
  ],
];

function lightTap() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

function confirmTap() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

export function ChessMoveKeypad({
  value,
  onChangeText,
  onSubmit,
  autoSubmit = true,
  enabled = true,
  compact = true,
  testID = 'chess-move-keypad',
}: Props) {
  const colors = useColors();
  const priority = useMemo(() => priorityMoveKeypadKeys(value), [value]);
  const keyMinHeight = compact ? 38 : DesignTokens.minTouchTarget;
  const rowGap = compact ? 4 : 6;
  const panelPad = compact ? 6 : DesignTokens.spacing.sm;

  const pressKey = useCallback(
    (key: KeyDef) => {
      if (!enabled) return;
      if (key.action === 'backspace') {
        lightTap();
        onChangeText(backspaceMoveKeypad(value));
        return;
      }
      if (key.action === 'clear') {
        lightTap();
        onChangeText(clearMoveKeypad());
        return;
      }
      if (!key.token) return;

      lightTap();
      const { value: next, readyToSubmit } = applyMoveKeypadToken(value, key.token);
      onChangeText(next);
      if (autoSubmit && readyToSubmit) {
        confirmTap();
        onSubmit(next);
      }
    },
    [autoSubmit, enabled, onChangeText, onSubmit, value],
  );

  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          padding: panelPad,
          gap: rowGap,
        },
      ]}
      testID={testID}
      accessibilityLabel="Clavier coups d’échecs"
    >
      {ROWS.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={[styles.row, { gap: rowGap }]}>
          {row.map((key) => {
            const isPriority = priority.has(key.id);
            const isClear = key.action === 'clear';
            const bg = isClear
              ? colors.muted
              : isPriority
                ? colors.accent
                : colors.secondary;
            const borderColor = isPriority ? colors.primary : 'transparent';
            const color = isClear ? colors.mutedForeground : colors.secondaryForeground;

            return (
              <Pressable
                key={key.id}
                onPress={() => pressKey(key)}
                disabled={!enabled}
                accessibilityLabel={key.a11y}
                testID={`${testID}-key-${key.id}`}
                style={({ pressed }) => [
                  styles.key,
                  {
                    flex: key.flex ?? 1,
                    minHeight: keyMinHeight,
                    backgroundColor: bg,
                    borderColor,
                    opacity: !enabled ? 0.45 : pressed ? 0.82 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.keyLabel,
                    {
                      color,
                      fontSize:
                        key.token === 'O-O-O' || key.token === 'O-O' || key.action === 'clear'
                          ? 12
                          : compact
                            ? 15
                            : 16,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {key.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.md,
  },
  row: {
    flexDirection: 'row',
  },
  key: {
    borderRadius: DesignTokens.radius.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  keyLabel: {
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
});
