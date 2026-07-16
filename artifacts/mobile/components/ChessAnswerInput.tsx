/**
 * Shared written chess-move answer field.
 *
 * Voice transcripts and typed text must both go through `parseChessVoice`
 * (or the caller's equivalent that uses it). This component does not invent
 * a second parser — it only collects text and optionally keeps focus ready
 * for rapid successive answers.
 *
 * Mode-specific correctness (puzzle / repertoire / opening line) stays
 * outside this component.
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
import { usePersistentAnswerFocus } from '@/hooks/usePersistentAnswerFocus';

export type ChessAnswerInputProps = {
  onSubmit: (raw: string) => void;
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
  enabled = true,
  persistFocus = true,
  placeholder = 'Ex. Nc3, Fou b5, e4, petit roque…',
  value: controlledValue,
  onChangeText: controlledOnChange,
  testID = 'chess-answer-input',
  inputProps,
}: ChessAnswerInputProps) {
  const colors = useColors();
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
        accessibilityLabel="Valider le coup"
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
