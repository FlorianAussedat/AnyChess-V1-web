/**
 * Chess move keypad — shared 6-column grid.
 * Auto-submits form-complete moves when requested; validation stays in the parent.
 * Piece letters follow the global chessNotation preference.
 * No permanent "Eff"/clear key — backspace only.
 * Promotion uses PromotionPicker (no permanent promo keys).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { triggerHaptic } from '@/lib/feedback/haptics';
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
import {
  appendPromotionSuffix,
  keypadBufferNeedsPromotion,
  type PromotionPiece,
} from '@/lib/moveInput/keypadPromotion';
import {
  KEYPAD_COLUMNS,
  keypadCellWidth,
  keypadSpanWidth,
} from '@/lib/moveInput/keypadGrid';
import { PromotionPicker } from '@/components/game/PromotionPicker';

type Props = {
  value: string;
  onChangeText: (next: string) => void;
  /**
   * Called with the completed buffer (auto-submit) — same validation path
   * as text/voice submit. Parent clears on success / handles game flow.
   */
  onSubmit: (raw: string) => void;
  /** When true (default), submit as soon as the buffer is form-complete. */
  autoSubmit?: boolean;
  /**
   * Position FEN for promotion detection. When omitted, promotion picker
   * is skipped (suffix must be typed somehow else / not applicable).
   */
  fen?: string;
  enabled?: boolean;
  compact?: boolean;
  testID?: string;
};

type KeyDef = {
  id: string;
  label: string;
  token?: MoveKeypadInsertToken;
  action?: 'backspace';
  /** Column span in the fixed 6-column grid (default 1). */
  span?: number;
  a11y: string;
};

function lightTap() {
  void triggerHaptic('keyTap');
}

function confirmTap() {
  void triggerHaptic('keyTap');
}

export function ChessMoveKeypad({
  value,
  onChangeText,
  onSubmit,
  autoSubmit = true,
  fen,
  enabled = true,
  compact = true,
  testID = 'chess-move-keypad',
}: Props) {
  const colors = useColors();
  const { chessNotation, language } = usePreferences();
  const { t } = useTranslation();
  const [rowWidth, setRowWidth] = useState(0);
  const [promotionDraft, setPromotionDraft] = useState<string | null>(null);

  useEffect(() => {
    setPromotionDraft(null);
  }, [chessNotation, fen]);

  const pieces = moveKeypadPiecesForNotation(chessNotation);
  const priority = useMemo(
    () => priorityMoveKeypadKeys(value, chessNotation),
    [value, chessNotation],
  );
  // Compact mockup-like heights (Canva reference).
  const keyMinHeight = compact ? 34 : DesignTokens.minTouchTarget;
  const gap = compact ? 3 : 6;
  const panelPad = compact ? 4 : DesignTokens.spacing.sm;

  const cellWidth = useMemo(
    () => keypadCellWidth(rowWidth, gap, KEYPAD_COLUMNS),
    [gap, rowWidth],
  );

  const rows: KeyDef[][] = useMemo(() => {
    const a11y = (token: MoveKeypadInsertToken | 'backspace') =>
      moveKeypadA11y(token, language, chessNotation);
    const [p0, p1, p2, p3, p4] = pieces;
    // Fixed 6-column grid (no Eff). Backspace spans rows 2–3 in column 6.
    // C|a|b|1|2|x
    // F|c|d|3|4|⌫
    // T|e|f|5|6|⌫
    // D|g|h|7|8|R
    // O-O———|O-O-O——
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
      ],
      [
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
        { id: 'O-O', label: 'O-O', token: 'O-O', span: 3, a11y: a11y('O-O') },
        { id: 'O-O-O', label: 'O-O-O', token: 'O-O-O', span: 3, a11y: a11y('O-O-O') },
      ],
    ];
  }, [chessNotation, language, pieces]);

  const backspaceKey = useMemo<KeyDef>(
    () => ({
      id: 'backspace',
      label: '⌫',
      action: 'backspace',
      a11y: moveKeypadA11y('backspace', language, chessNotation),
    }),
    [chessNotation, language],
  );

  const maybeSubmit = useCallback(
    (raw: string) => {
      if (fen && keypadBufferNeedsPromotion(raw, fen, chessNotation)) {
        setPromotionDraft(raw);
        return;
      }
      if (autoSubmit) {
        confirmTap();
        onSubmit(raw);
      }
    },
    [autoSubmit, chessNotation, fen, onSubmit],
  );

  const pressKey = useCallback(
    (key: KeyDef) => {
      if (!enabled) return;
      if (key.action === 'backspace') {
        lightTap();
        setPromotionDraft(null);
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
      if (readyToSubmit) {
        maybeSubmit(next);
      }
    },
    [chessNotation, enabled, maybeSubmit, onChangeText, value],
  );

  const onPromotionChoose = useCallback(
    (piece: PromotionPiece) => {
      if (!promotionDraft) return;
      const withPromo = appendPromotionSuffix(
        promotionDraft,
        piece,
        chessNotation,
      );
      setPromotionDraft(null);
      onChangeText(withPromo);
      if (autoSubmit) {
        confirmTap();
        onSubmit(withPromo);
      }
    },
    [autoSubmit, chessNotation, onChangeText, onSubmit, promotionDraft],
  );

  const onPromotionCancel = useCallback(() => {
    setPromotionDraft(null);
  }, []);

  const onRowLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setRowWidth((prev) => (Math.abs(prev - w) < 0.5 ? prev : w));
  }, []);

  const renderKey = useCallback(
    (key: KeyDef) => {
      const span = key.span ?? 1;
      const isPriority = priority.has(key.id);
      const bg = isPriority ? colors.accent : colors.secondary;
      const borderColor = isPriority ? colors.primary : 'transparent';
      const color = colors.secondaryForeground;
      const width =
        cellWidth > 0 ? keypadSpanWidth(cellWidth, gap, span) : undefined;

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
              width,
              flexGrow: width == null ? span : 0,
              flexBasis: width == null ? 0 : undefined,
              flexShrink: 0,
              height: keyMinHeight,
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
    },
    [
      cellWidth,
      colors.accent,
      colors.primary,
      colors.secondary,
      colors.secondaryForeground,
      compact,
      enabled,
      gap,
      keyMinHeight,
      pressKey,
      priority,
      testID,
    ],
  );

  const tallBackspaceHeight = keyMinHeight * 2 + gap;

  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          padding: panelPad,
          gap,
        },
      ]}
      testID={testID}
      accessibilityLabel={t('keypad.a11y')}
    >
      {rows.map((row, rowIndex) => {
        if (rowIndex === 2) {
          return null;
        }

        if (rowIndex === 1) {
          const backspaceWidth =
            cellWidth > 0 ? keypadSpanWidth(cellWidth, gap, 1) : undefined;
          const isPriority = priority.has(backspaceKey.id);
          const bg = isPriority ? colors.accent : colors.secondary;
          const borderColor = isPriority ? colors.primary : 'transparent';
          const color = colors.secondaryForeground;

          return (
            <View
              key="row-backspace-block"
              style={[styles.row, { gap }]}
            >
              <View style={[styles.stackedRows, { gap }]}>
                <View style={[styles.row, { gap }]}>
                  {row.map(renderKey)}
                </View>
                <View style={[styles.row, { gap }]}>
                  {rows[2].map(renderKey)}
                </View>
              </View>
              <Pressable
                onPress={() => pressKey(backspaceKey)}
                disabled={!enabled}
                accessibilityLabel={backspaceKey.a11y}
                testID={`${testID}-key-${backspaceKey.id}`}
                style={({ pressed }) => [
                  styles.key,
                  {
                    width: backspaceWidth,
                    flexGrow: backspaceWidth == null ? 1 : 0,
                    flexBasis: backspaceWidth == null ? 0 : undefined,
                    flexShrink: 0,
                    height: tallBackspaceHeight,
                    minHeight: tallBackspaceHeight,
                    backgroundColor: bg,
                    borderColor,
                    opacity: !enabled ? 0.45 : pressed ? 0.82 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.keyLabel,
                    { color, fontSize: compact ? 14 : 16 },
                  ]}
                  numberOfLines={1}
                >
                  {backspaceKey.label}
                </Text>
              </Pressable>
            </View>
          );
        }

        return (
          <View
            key={`row-${rowIndex}`}
            style={[styles.row, { gap }]}
            onLayout={rowIndex === 0 ? onRowLayout : undefined}
          >
            {row.map(renderKey)}
          </View>
        );
      })}

      <PromotionPicker
        visible={promotionDraft != null}
        onChoose={onPromotionChoose}
        onCancel={onPromotionCancel}
        testID={`${testID}-promotion`}
      />
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
    alignItems: 'stretch',
  },
  stackedRows: {
    flexDirection: 'column',
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
