/**
 * Free-text answer field (native soft keyboard).
 *
 * Use for names, comments, natural-language answers, search, etc.
 * For chess notation answers, use `ChessMoveInput` instead
 * (`inputType: "chess-move"`) so the AnyChess keypad is shown and the
 * native keyboard stays closed.
 *
 * Voice transcripts and typed text must both go through `parseChessVoice`
 * (or the caller's equivalent) when the answer is chess-related.
 * Mode-specific correctness stays outside this component.
 */
import React, { useCallback, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { usePersistentAnswerFocus } from '@/hooks/usePersistentAnswerFocus';

export type ChessAnswerInputProps = {
  onSubmit: (raw: string) => void;
  /** Semantic free-text marker (native keyboard). */
  inputType?: 'free-text';
  /** When false, input is disabled and focus is not forced. */
  enabled?: boolean;
  /** Keep focus after submit for timed / rapid modes. Default true. */
  persistFocus?: boolean;
  placeholder?: string;
  /** Controlled value — when omitted, the field is uncontrolled internally. */
  value?: string;
  onChangeText?: (text: string) => void;
  testID?: string;
  /** Extra TextInput props (autoCapitalize, etc.). */
  inputProps?: Omit<
    TextInputProps,
    'value' | 'onChangeText' | 'onSubmitEditing' | 'editable' | 'style'
  >;
};

export function ChessAnswerInput({
  onSubmit,
  inputType: _inputType = 'free-text',
  enabled = true,
  persistFocus = true,
  placeholder = 'Ex. Nc3, Fou b5, e4, petit roque…',
  value: controlledValue,
  onChangeText: controlledOnChange,
  testID = 'chess-answer-input',
  inputProps,
}: ChessAnswerInputProps) {
  const colors = useColors();
  const { t } = useTranslation();
  const [internal, setInternal] = useState('');
  const isControlled = controlledValue !== undefined;
  const text = isControlled ? controlledValue : internal;
  const setText = controlledOnChange ?? setInternal;

  const { inputRef, afterSubmit } = usePersistentAnswerFocus({
    enabled: enabled && persistFocus,
  });

  const submit = useCallback(() => {
    const raw = text.trim();
    if (!raw || !enabled) return;
    onSubmit(raw);
    afterSubmit(() => setText(''));
  }, [text, enabled, onSubmit, afterSubmit, setText]);

  return (
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
        showSoftInputOnFocus
        testID={testID}
        {...inputProps}
      />
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
    </View>
  );
}

/** Compact status line for parse feedback (optional companion). */
export function ChessAnswerStatus({
  message,
  tone = 'neutral',
}: {
  message: string;
  tone?: 'neutral' | 'ok' | 'error';
}) {
  const colors = useColors();
  const color =
    tone === 'ok' ? '#398a55' : tone === 'error' ? '#c44' : colors.mutedForeground;
  if (!message) return null;
  return <Text style={{ color, fontSize: 13 }}>{message}</Text>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    minWidth: 160,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
