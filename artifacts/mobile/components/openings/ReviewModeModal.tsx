import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { ReviewTrainingMode } from '@/lib/repertoire';

type Props = {
  visible: boolean;
  title?: string;
  onClose: () => void;
  onChoose: (mode: ReviewTrainingMode) => void;
};

export function ReviewModeModal({
  visible,
  title = 'Mode de révision',
  onClose,
  onChoose,
}: Props) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>{title}</Text>

          <Pressable
            onPress={() => onChoose('continue')}
            testID="review-mode-continue"
            style={({ pressed }) => [
              styles.modeRow,
              {
                borderColor: colors.border,
                backgroundColor: colors.input,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Ionicons name="mic-outline" size={22} color={colors.primary} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
                Continue la ligne
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_400Regular' }}>
                Récite les coups de ton répertoire.
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => onChoose('board')}
            testID="review-mode-board"
            style={({ pressed }) => [
              styles.modeRow,
              {
                borderColor: colors.border,
                backgroundColor: colors.input,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Ionicons name="grid-outline" size={22} color={colors.primary} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
                Échiquier
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_400Regular' }}>
                Joue les coups directement sur l’échiquier.
              </Text>
            </View>
          </Pressable>

          <View style={styles.modalActions}>
            <Pressable
              onPress={onClose}
              testID="review-mode-cancel"
              style={({ pressed }) => [
                styles.modalBtn,
                { borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}>
                Annuler
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
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  modalBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
});
