import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import type { RepertoireSide } from '@/lib/repertoire';
import { RepertoireSidePicker } from '@/components/RepertoireSidePicker';

type Props = {
  visible: boolean;
  folderName: string;
  migrationSide: RepertoireSide | null;
  onMigrationSideChange: (side: RepertoireSide) => void;
  busy: boolean;
  onCancel: () => void;
  onSave: () => void;
  onRequestClose: () => void;
};

export function SideMigrationModal({
  visible,
  folderName,
  migrationSide,
  onMigrationSideChange,
  busy,
  onCancel,
  onSave,
  onRequestClose,
}: Props) {
  const colors = useColors();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>
            Côté du répertoire
          </Text>
          <Text style={[styles.fileMeta, { color: colors.mutedForeground }]}>
            De quel côté travaillez-vous « {folderName} » ?
          </Text>
          <RepertoireSidePicker
            value={migrationSide}
            onChange={onMigrationSideChange}
            disabled={busy}
          />
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
              onPress={onSave}
              disabled={busy || !migrationSide}
              style={({ pressed }) => [
                styles.modalBtn,
                {
                  backgroundColor: colors.primary,
                  borderColor: colors.primary,
                  opacity: pressed || busy || !migrationSide ? 0.6 : 1,
                },
              ]}
            >
              <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold' }}>
                Enregistrer
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
    padding: 18,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  fileMeta: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  modalBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
});
