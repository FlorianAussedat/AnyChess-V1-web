/**
 * Chess move keypad V2 — Classic Mode opt-in.
 * Builds a French move string; validation stays outside (parseChessVoice).
 */
import React, { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { DesignTokens } from '@/constants/designTokens';
import {
  MOVE_KEYPAD_A11Y,
  appendMoveKeypadToken,
  backspaceMoveKeypad,
  canSubmitMoveKeypad,
  clearMoveKeypad,
  priorityMoveKeypadKeys,
  type MoveKeypadInsertToken,
} from '@/lib/moveInput/chessMoveKeypad';

type Props = {
  value: string;
  onChangeText: (next: string) => void;
  /** Same submit path as the ChessAnswerInput arrow. */
  onSubmit: () => void;
  enabled?: boolean;
  testID?: string;
};

type KeyDef = {
  id: string;
  label: string;
  token?: MoveKeypadInsertToken;
  action?: 'backspace' | 'clear' | 'submit';
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
    { id: '+', label: '+', token: '+', a11y: MOVE_KEYPAD_A11Y['+'] },
  ],
  [
    { id: 'T', label: 'T', token: 'T', a11y: MOVE_KEYPAD_A11Y.T },
    { id: 'e', label: 'e', token: 'e', a11y: MOVE_KEYPAD_A11Y.e },
    { id: 'f', label: 'f', token: 'f', a11y: MOVE_KEYPAD_A11Y.f },
    { id: '5', label: '5', token: '5', a11y: MOVE_KEYPAD_A11Y['5'] },
    { id: '6', label: '6', token: '6', a11y: MOVE_KEYPAD_A11Y['6'] },
    { id: '#', label: '#', token: '#', a11y: MOVE_KEYPAD_A11Y['#'] },
  ],
  [
    { id: 'D', label: 'D', token: 'D', a11y: MOVE_KEYPAD_A11Y.D },
    { id: 'g', label: 'g', token: 'g', a11y: MOVE_KEYPAD_A11Y.g },
    { id: 'h', label: 'h', token: 'h', a11y: MOVE_KEYPAD_A11Y.h },
    { id: '7', label: '7', token: '7', a11y: MOVE_KEYPAD_A11Y['7'] },
    { id: '8', label: '8', token: '8', a11y: MOVE_KEYPAD_A11Y['8'] },
    { id: 'backspace', label: '⌫', action: 'backspace', a11y: MOVE_KEYPAD_A11Y.backspace },
  ],
  [
    { id: 'R', label: 'R', token: 'R', a11y: MOVE_KEYPAD_A11Y.R },
    { id: 'O-O', label: 'O-O', token: 'O-O', flex: 2, a11y: MOVE_KEYPAD_A11Y['O-O'] },
    { id: 'O-O-O', label: 'O-O-O', token: 'O-O-O', flex: 2, a11y: MOVE_KEYPAD_A11Y['O-O-O'] },
    { id: 'submit', label: 'OK', action: 'submit', a11y: MOVE_KEYPAD_A11Y.submit },
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
  enabled = true,
  testID = 'chess-move-keypad',
}: Props) {
  const colors = useColors();
  const priority = useMemo(() => priorityMoveKeypadKeys(value), [value]);
  const canSubmit = enabled && canSubmitMoveKeypad(value);

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
      if (key.action === 'submit') {
        if (!canSubmitMoveKeypad(value)) return;
        confirmTap();
        onSubmit();
        return;
      }
      if (key.token) {
        lightTap();
        onChangeText(appendMoveKeypadToken(value, key.token));
      }
    },
    [enabled, onChangeText, onSubmit, value],
  );

  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
      testID={testID}
      accessibilityLabel="Clavier coups d’échecs"
    >
      {ROWS.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.row}>
          {row.map((key) => {
            const isSubmit = key.action === 'submit';
            const isPriority = priority.has(key.id) || (isSubmit && priority.has('submit'));
            const disabled = !enabled || (isSubmit && !canSubmit);
            const bg = isSubmit
              ? colors.primary
              : isPriority
                ? colors.accent
                : colors.secondary;
            const borderColor = isPriority && !isSubmit ? colors.primary : 'transparent';
            const color = isSubmit ? colors.primaryForeground : colors.secondaryForeground;

            return (
              <Pressable
                key={key.id}
                onPress={() => pressKey(key)}
                disabled={disabled}
                accessibilityLabel={key.a11y}
                testID={`${testID}-key-${key.id}`}
                style={({ pressed }) => [
                  styles.key,
                  {
                    flex: key.flex ?? 1,
                    backgroundColor: bg,
                    borderColor,
                    opacity: disabled ? 0.45 : pressed ? 0.82 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.keyLabel,
                    {
                      color,
                      fontSize: key.token === 'O-O-O' || key.token === 'O-O' ? 13 : 16,
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

      <Pressable
        onPress={() => {
          if (!enabled) return;
          lightTap();
          onChangeText(clearMoveKeypad());
        }}
        disabled={!enabled || !value}
        accessibilityLabel={MOVE_KEYPAD_A11Y.clear}
        testID={`${testID}-clear`}
        style={({ pressed }) => [
          styles.clearBtn,
          {
            borderColor: colors.border,
            backgroundColor: colors.muted,
            opacity: !enabled || !value ? 0.4 : pressed ? 0.8 : 1,
          },
        ]}
      >
        <Text style={[styles.clearLabel, { color: colors.mutedForeground }]}>Effacer</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.md,
    padding: DesignTokens.spacing.sm,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 6,
  },
  key: {
    minHeight: DesignTokens.minTouchTarget,
    borderRadius: DesignTokens.radius.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  keyLabel: {
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  clearBtn: {
    minHeight: 40,
    borderRadius: DesignTokens.radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  clearLabel: {
    fontSize: 14,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
});
