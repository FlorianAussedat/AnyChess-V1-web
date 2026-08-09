/**
 * Chess move keypad — Classic Mode opt-in.
 * Auto-submits form-complete moves; validation stays in applyUserMove.
 * Piece letters follow the global chessNotation preference.
 * No permanent "Eff"/clear key — backspace only.
 */
import React, { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { usePreferences } from '@/hooks/usePreferences';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import {
  applyMoveKeypadToken,
  backspaceMoveKeypad,
  moveKeypadA11y,
  moveKeypadPiecesForNotation,
  priorityMoveKeypadKeys,
  type MoveKeypadInsertToken,
} from '@/lib/moveInput/chessMoveKeypad';

type Props = {
  value: string;
  onChangeText: (next: string) => void;
  /**
   * Called with the completed buffer (auto-submit) — same validation path
   * as text/voice submit. Parent clears on success / handles promotion.
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
  action?: 'backspace';
  flex?: number;
  a11y: string;
};

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
  const { chessNotation, language } = usePreferences();
  const { t } = useTranslation();

  const pieces = moveKeypadPiecesForNotation(chessNotation);
  const priority = useMemo(
    () => priorityMoveKeypadKeys(value, chessNotation),
    [value, chessNotation],
  );
  // Compact mockup-like heights (Canva reference).
  const keyMinHeight = compact ? 34 : DesignTokens.minTouchTarget;
  const rowGap = compact ? 3 : 6;
  const panelPad = compact ? 4 : DesignTokens.spacing.sm;

  const rows: KeyDef[][] = useMemo(() => {
    const a11y = (token: MoveKeypadInsertToken | 'backspace') =>
      moveKeypadA11y(token, language, chessNotation);
    const [p0, p1, p2, p3, p4] = pieces;
    // Mockup grid (no Eff):
    // C|a|b|1|2|x
    // F|c|d|3|4|⌫
    // T|e|f|5|6|
    // D|g|h|7|8|R
    // O-O | O-O-O
    return [
      [
        { id: p0, label: p0, token: p0, a11y: a11y(p0) },
        { id: 'a', label: 'a', token: 'a', a11y: a11y('a') },
        { id: 'b', label: 'b', token: 'b', a11y: a11y('b') },
        { id: '1', label: '1', token: '1', a11y: a11y('1') },
        { id: '2', label: '2', token: '2', a11y: a11y('2') },
        { id: 'x', label: 'x', token: 'x', a11y: a11y('x') },
      ],
      [
        { id: p1, label: p1, token: p1, a11y: a11y(p1) },
        { id: 'c', label: 'c', token: 'c', a11y: a11y('c') },
        { id: 'd', label: 'd', token: 'd', a11y: a11y('d') },
        { id: '3', label: '3', token: '3', a11y: a11y('3') },
        { id: '4', label: '4', token: '4', a11y: a11y('4') },
        { id: 'backspace', label: '⌫', action: 'backspace', a11y: a11y('backspace') },
      ],
      [
        // Five keys — stretch evenly (no empty Eff cell).
        { id: p2, label: p2, token: p2, a11y: a11y(p2) },
        { id: 'e', label: 'e', token: 'e', a11y: a11y('e') },
        { id: 'f', label: 'f', token: 'f', a11y: a11y('f') },
        { id: '5', label: '5', token: '5', a11y: a11y('5') },
        { id: '6', label: '6', token: '6', a11y: a11y('6') },
      ],
      [
        { id: p3, label: p3, token: p3, a11y: a11y(p3) },
        { id: 'g', label: 'g', token: 'g', a11y: a11y('g') },
        { id: 'h', label: 'h', token: 'h', a11y: a11y('h') },
        { id: '7', label: '7', token: '7', a11y: a11y('7') },
        { id: '8', label: '8', token: '8', a11y: a11y('8') },
        { id: p4, label: p4, token: p4, a11y: a11y(p4) },
      ],
      [
        { id: 'O-O', label: 'O-O', token: 'O-O', flex: 1, a11y: a11y('O-O') },
        { id: 'O-O-O', label: 'O-O-O', token: 'O-O-O', flex: 1, a11y: a11y('O-O-O') },
      ],
    ];
  }, [chessNotation, language, pieces]);

  const pressKey = useCallback(
    (key: KeyDef) => {
      if (!enabled) return;
      if (key.action === 'backspace') {
        lightTap();
        onChangeText(backspaceMoveKeypad(value));
        return;
      }
      if (!key.token) return;

      lightTap();
      const { value: next, readyToSubmit } = applyMoveKeypadToken(
        value,
        key.token,
        chessNotation,
      );
      onChangeText(next);
      if (autoSubmit && readyToSubmit) {
        confirmTap();
        onSubmit(next);
      }
    },
    [autoSubmit, chessNotation, enabled, onChangeText, onSubmit, value],
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
      accessibilityLabel={t('keypad.a11y')}
    >
      {rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={[styles.row, { gap: rowGap }]}>
          {row.map((key) => {
            const isPriority = priority.has(key.id);
            const bg = isPriority ? colors.accent : colors.secondary;
            const borderColor = isPriority ? colors.primary : 'transparent';
            const color = colors.secondaryForeground;

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
                        key.token === 'O-O-O' || key.token === 'O-O'
                          ? 11
                          : compact
                            ? 14
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
