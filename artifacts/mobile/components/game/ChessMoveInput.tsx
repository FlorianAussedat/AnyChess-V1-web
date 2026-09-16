/**
 * Shared chess-move answer field: draft display + ChessMoveKeypad.
 *
 * Uses AnswerInputType "chess-move" semantics — never opens the native
 * soft keyboard. Free-text answers should keep ChessAnswerInput / TextInput.
 *
 * Parent mode logic decides when an answer is complete (one move vs sequence).
 * With autoSubmit=false (default here), the keypad builds the buffer and the
 * send control submits; the keyboard stays available for the next answer.
 *
 * One shared ChessKeyboardToggle shows/hides the keypad.
 */
import React, { useCallback, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { usePersistentAnswerFocus } from '@/hooks/usePersistentAnswerFocus';
import { DesignTokens } from '@/constants/designTokens';
import { ChessMoveKeypad } from '@/components/game/ChessMoveKeypad';
import { ChessKeyboardToggle } from '@/components/game/ChessKeyboardToggle';
import type { AnswerInputType } from '@/lib/moveInput/answerInputType';

export type ChessMoveInputProps = {
  onSubmit: (raw: string) => void;
  /** Position used for promotion detection on the keypad. */
  fen: string;
  /** Semantic marker — always chess-move for this component. */
  inputType?: Extract<AnswerInputType, 'chess-move'>;
  enabled?: boolean;
  /** Keep focus after submit for timed / rapid modes. Default true. */
  persistFocus?: boolean;
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  /**
   * When true, form-complete moves auto-submit via the keypad
   * (Classic-style). Default false — parent validates via send.
   */
  autoSubmit?: boolean;
  showSendButton?: boolean;
  /**
   * Show the shared keypad visibility toggle beside send.
   * Default true — one button opens/closes the chess keypad.
   */
  showKeyboardToggle?: boolean;
  /** Controlled keypad visibility. When omitted, starts visible. */
  keypadVisible?: boolean;
  onKeypadVisibleChange?: (visible: boolean) => void;
  /** Uncontrolled initial visibility when keypadVisible is omitted. */
  defaultKeypadVisible?: boolean;
  /** Optional trailing controls in the input row (e.g. compact mic). */
  trailingControls?: React.ReactNode;
  /**
   * When false, only the field row is rendered — parent places
   * `ChessMoveKeypad` elsewhere (e.g. below the board). Toggle still
   * controls `keypadVisible` when `showKeyboardToggle` is true.
   */
  attachKeypad?: boolean;
  compact?: boolean;
  testID?: string;
  inputProps?: Omit<
    TextInputProps,
    | 'value'
    | 'onChangeText'
    | 'onSubmitEditing'
    | 'editable'
    | 'style'
    | 'showSoftInputOnFocus'
  >;
};

export function ChessMoveInput({
  onSubmit,
  fen,
  inputType: _inputType = 'chess-move',
  enabled = true,
  persistFocus = true,
  placeholder = 'Ex. Nc3, Fou b5, e4, petit roque…',
  value: controlledValue,
  onChangeText: controlledOnChange,
  autoSubmit = false,
  showSendButton = true,
  showKeyboardToggle = true,
  keypadVisible: controlledKeypadVisible,
  onKeypadVisibleChange,
  defaultKeypadVisible = true,
  trailingControls,
  attachKeypad = true,
  compact = true,
  testID = 'chess-move-input',
  inputProps,
}: ChessMoveInputProps) {
  const colors = useColors();
  const { t } = useTranslation();
  const [internal, setInternal] = useState('');
  const isControlled = controlledValue !== undefined;
  const text = isControlled ? controlledValue : internal;
  const setText = controlledOnChange ?? setInternal;

  const [internalKeypadVisible, setInternalKeypadVisible] = useState(
    defaultKeypadVisible,
  );
  const keypadControlled = controlledKeypadVisible !== undefined;
  const keypadVisible = keypadControlled
    ? controlledKeypadVisible
    : internalKeypadVisible;

  const setKeypadVisible = useCallback(
    (next: boolean) => {
      if (!keypadControlled) setInternalKeypadVisible(next);
      onKeypadVisibleChange?.(next);
    },
    [keypadControlled, onKeypadVisibleChange],
  );

  const { inputRef, afterSubmit } = usePersistentAnswerFocus({
    enabled: enabled && persistFocus,
  });

  const submit = useCallback(() => {
    const raw = text.trim();
    if (!raw || !enabled) return;
    onSubmit(raw);
    afterSubmit(() => setText(''));
  }, [afterSubmit, enabled, onSubmit, setText, text]);

  const onKeypadSubmit = useCallback(
    (raw: string) => {
      if (!enabled) return;
      onSubmit(raw.trim());
      afterSubmit(() => setText(''));
    },
    [afterSubmit, enabled, onSubmit, setText],
  );

  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.row}>
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            {
              backgroundColor: colors.input,
              color: colors.foreground,
              borderColor: colors.border,
              opacity: enabled ? 1 : 0.55,
            },
          ]}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          onSubmitEditing={submit}
          returnKeyType="send"
          editable={enabled}
          autoCorrect={false}
          autoCapitalize="none"
          // Chess notation — never summon the native soft keyboard.
          showSoftInputOnFocus={false}
          caretHidden={false}
          testID={`${testID}-field`}
          {...inputProps}
        />
        {showSendButton ? (
          <Pressable
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor: colors.primary,
                opacity: pressed || !enabled ? 0.72 : 1,
              },
            ]}
            onPress={submit}
            disabled={!enabled}
            testID={`${testID}-send`}
            accessibilityLabel={t('a11y.validateMove')}
          >
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </Pressable>
        ) : null}
        {showKeyboardToggle ? (
          <ChessKeyboardToggle
            active={keypadVisible}
            onToggle={() => setKeypadVisible(!keypadVisible)}
            variant="visibility"
            disabled={!enabled && !keypadVisible}
            testID={`${testID}-keypad-toggle`}
          />
        ) : null}
        {trailingControls}
      </View>

      {attachKeypad && keypadVisible ? (
        <ChessMoveKeypad
          value={text}
          onChangeText={setText}
          onSubmit={onKeypadSubmit}
          autoSubmit={autoSubmit}
          fen={fen}
          enabled={enabled}
          compact={compact}
          testID={`${testID}-keypad`}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: DesignTokens.spacing.sm,
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.spacing.sm,
  },
  input: {
    flex: 1,
    minWidth: 120,
    minHeight: DesignTokens.chessScreen.inputHeight,
    borderWidth: 1,
    borderRadius: DesignTokens.chessScreen.inputRadius,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  sendBtn: {
    width: DesignTokens.chessScreen.inputHeight,
    height: DesignTokens.chessScreen.inputHeight,
    borderRadius: DesignTokens.chessScreen.inputRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
