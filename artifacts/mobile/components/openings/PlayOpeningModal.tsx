import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import type { RepertoireSide } from '@/lib/repertoire';
import { sideLabel } from '@/components/RepertoireSidePicker';

type Props = {
  visible: boolean;
  folderName: string;
  folderSide?: RepertoireSide;
  onCancel: () => void;
  onConfirm: () => void;
  onRequestClose: () => void;
};

export function PlayOpeningModal({
  visible,
  folderName,
  folderSide,
  onCancel,
  onConfirm,
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
            Lancer une partie
          </Text>
          <Text style={[styles.fileMeta, { color: colors.mutedForeground }]}>
            Répertoire : {folderName}
            {folderSide ? ` · ${sideLabel(folderSide)}` : ''}
          </Text>
          <Text style={[styles.fileMeta, { color: colors.mutedForeground, marginTop: 8 }]}>
            L’échiquier s’oriente selon le côté enregistré pour ce répertoire.
            {'\n\n'}
            L’adversaire suit ton répertoire tant que tu restes dans la théorie. Dès que tu en
            sors, Stockfish prend le relais.
          </Text>
          <View style={styles.modalActions}>
            <Pressable
              onPress={onCancel}
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
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.modalBtn,
                {
                  backgroundColor: colors.primary,
                  borderColor: colors.primary,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              testID="confirm-play-btn"
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
