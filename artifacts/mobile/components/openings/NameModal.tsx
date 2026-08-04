import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';

export interface NameModalProps {
  visible: boolean;
  title: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  busy: boolean;
  error: string | null;
  submitLabel: string;
}

export function NameModal({
  visible,
  title,
  placeholder,
  value,
  onChangeText,
  onCancel,
  onSubmit,
  busy,
  error,
  submitLabel,
}: NameModalProps) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>{title}</Text>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={colors.mutedForeground}
            autoFocus
            style={[
              styles.modalInput,
              {
                backgroundColor: colors.input,
                color: colors.foreground,
                borderColor: colors.border,
              },
            ]}
            onSubmitEditing={onSubmit}
            editable={!busy}
          />
          {!!error && (
            <Text style={[styles.modalError, { color: colors.destructive }]}>{error}</Text>
          )}
          <View style={styles.modalActions}>
            <Pressable
              onPress={onCancel}
              disabled={busy}
              style={({ pressed }) => [
                styles.modalBtn,
                { borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}>
                Annuler
              </Text>
            </Pressable>
            <Pressable
              onPress={onSubmit}
              disabled={busy || !value.trim()}
              style={({ pressed }) => [
                styles.modalBtn,
                {
                  backgroundColor: colors.primary,
                  borderColor: colors.primary,
                  opacity: pressed || busy || !value.trim() ? 0.6 : 1,
                },
              ]}
            >
              <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold' }}>
                {busy ? '…' : submitLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  modalTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  modalInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  modalError: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  modalBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
});
