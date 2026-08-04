import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { RepertoireFolder } from '@/lib/repertoire';
import { sideLabel } from '@/components/RepertoireSidePicker';

type Props = {
  visible: boolean;
  trainable: RepertoireFolder[];
  mixedSelect: Set<string>;
  onClose: () => void;
  onSelectAll: () => void;
  onToggleFolder: (folderId: string) => void;
  onStart: () => void;
};

export function MixedTrainingModal({
  visible,
  trainable,
  mixedSelect,
  onClose,
  onSelectAll,
  onToggleFolder,
  onStart,
}: Props) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>
            Répertoires à mélanger
          </Text>
          <Pressable onPress={onSelectAll} hitSlop={8}>
            <Text style={{ color: colors.primary, fontFamily: 'Inter_500Medium', fontSize: 12 }}>
              Tout sélectionner
            </Text>
          </Pressable>
          <View style={{ gap: 8, maxHeight: 280 }}>
            {trainable.map((folder) => {
              const selected = mixedSelect.has(folder.id);
              return (
                <Pressable
                  key={folder.id}
                  onPress={() => onToggleFolder(folder.id)}
                  style={[
                    styles.mixedRow,
                    {
                      borderColor: colors.border,
                      backgroundColor: selected ? colors.input : colors.card,
                    },
                  ]}
                >
                  <Ionicons
                    name={selected ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={selected ? colors.primary : colors.mutedForeground}
                  />
                  <Text style={{ flex: 1, color: colors.foreground, fontFamily: 'Inter_500Medium' }}>
                    {folder.name}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                    {folder.side ? sideLabel(folder.side) : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.modalActions}>
            <Pressable
              onPress={onClose}
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
              onPress={onStart}
              disabled={mixedSelect.size === 0}
              style={({ pressed }) => [
                styles.modalBtn,
                {
                  backgroundColor: colors.primary,
                  borderColor: colors.primary,
                  opacity: pressed || mixedSelect.size === 0 ? 0.6 : 1,
                },
              ]}
            >
              <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold' }}>
                Commencer
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
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  modalBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  mixedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
});
