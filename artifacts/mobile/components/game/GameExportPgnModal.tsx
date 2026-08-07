import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

type Props = {
  visible: boolean;
  body: string;
  exportedText: string;
  exportPgn: () => string;
  downloadPgn: () => void;
  onClose: () => void;
};

export function GameExportPgnModal({
  visible,
  body,
  exportedText,
  exportPgn,
  downloadPgn,
  onClose,
}: Props) {
  const colors = useColors();
  const isWeb = Platform.OS === 'web';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>
            Exporter la partie en PGN ?
          </Text>
          <Text style={[styles.modalBody, { color: colors.mutedForeground }]}>{body}</Text>
          <View style={styles.modalActions}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.modalBtn,
                { borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}>Non</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (isWeb) downloadPgn();
                else if (typeof navigator !== 'undefined' && navigator.clipboard) {
                  navigator.clipboard.writeText(exportedText || exportPgn()).catch(() => {});
                }
                onClose();
              }}
              style={({ pressed }) => [
                styles.modalBtn,
                {
                  backgroundColor: colors.primary,
                  borderColor: colors.primary,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold' }}>
                Oui
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
    maxWidth: 360,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  modalTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  modalBody: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19 },
  modalActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
});
