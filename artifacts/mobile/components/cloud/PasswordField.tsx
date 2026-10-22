import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { DesignTokens } from '@/constants/designTokens';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  testID: string;
  /** Login uses the current password. Creation and reset use a new one. */
  purpose: 'current' | 'new';
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
};

/**
 * Masked by default. The eye toggles visibility without submitting
 * and without replacing the typed value. Unmounting the field masks again.
 */
export function PasswordField({
  value,
  onChangeText,
  placeholder,
  testID,
  purpose,
  onSubmitEditing,
}: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [pinned, setPinned] = useState<{ start: number; end: number } | undefined>(undefined);
  const inputRef = useRef<TextInput>(null);
  const selectionRef = useRef<{ start: number; end: number }>({ start: value.length, end: value.length });
  const label = visible ? t('account.hidePassword') : t('account.showPassword');

  const toggle = () => {
    const next = selectionRef.current;
    setPinned(next);
    setVisible((current) => !current);
    inputRef.current?.focus();
  };

  return (
    <View style={styles.wrap}>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!visible}
        selection={pinned}
        onSelectionChange={(event) => {
          selectionRef.current = event.nativeEvent.selection;
          if (pinned) setPinned(undefined);
        }}
        accessibilityLabel={placeholder}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        textContentType={purpose === 'new' ? 'newPassword' : 'password'}
        autoComplete={purpose === 'new' ? 'password-new' : 'password'}
        importantForAutofill="yes"
        onSubmitEditing={onSubmitEditing}
        style={[
          styles.input,
          { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.input },
        ]}
        testID={testID}
      />
      <Pressable
        testID={`${testID}-toggle`}
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={toggle}
        style={styles.eye}
      >
        <EyeIcon open={visible} color={colors.primary} />
      </Pressable>
    </View>
  );
}

function EyeIcon({ open, color }: { open: boolean; color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path
        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
      />
      <Path
        d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
      />
      {open ? null : (
        <Path d="M5 19L19 5" fill="none" stroke={color} strokeWidth={1.8} />
      )}
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', justifyContent: 'center' },
  input: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.sm,
    paddingLeft: 12,
    paddingRight: 48,
    paddingVertical: 10,
    minHeight: DesignTokens.minTouchTarget,
  },
  eye: {
    position: 'absolute',
    right: 4,
    width: DesignTokens.minTouchTarget,
    height: DesignTokens.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
