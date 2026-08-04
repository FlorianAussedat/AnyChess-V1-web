import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import type { StoredPgnFile } from '@/lib/repertoire';
import { formatDate } from '@/components/openings/formatDate';

type Props = {
  file: StoredPgnFile | null;
  onClose: () => void;
};

export function PgnFileDetailModal({ file, onClose }: Props) {
  const colors = useColors();

  return (
    <Modal
      visible={file != null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View
          style={[
            styles.modalCard,
            { backgroundColor: colors.card, borderColor: colors.border, maxHeight: '85%' },
          ]}
        >
          {file && (
            <>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {file.filename}
              </Text>
              <ScrollView style={{ maxHeight: 360 }}>
                <Text style={[styles.fileMeta, { color: colors.mutedForeground }]}>
                  Importé le {formatDate(file.importedAt)}
                </Text>
                <Text style={[styles.fileMeta, { color: colors.mutedForeground, marginTop: 6 }]}>
                  Parties / chapitres : {file.summary.gameCount}
                </Text>
                <Text style={[styles.fileMeta, { color: colors.mutedForeground }]}>
                  Positions parsées : {file.summary.positionCount}
                </Text>
                <Text style={[styles.fileMeta, { color: colors.mutedForeground }]}>
                  Branches : {file.summary.branchCount}
                </Text>
                <Text
                  style={[
                    styles.fileStatus,
                    {
                      marginTop: 8,
                      color: file.summary.parseSucceeded ? '#27AE60' : colors.destructive,
                    },
                  ]}
                >
                  {file.summary.parseSucceeded
                    ? file.summary.errors.length > 0
                      ? 'Import partiel — certaines lignes rejetées'
                      : 'Import réussi'
                    : 'Échec d’import'}
                </Text>

                {file.summary.errors.length > 0 && (
                  <View style={{ marginTop: 12, gap: 4 }}>
                    <Text style={[styles.fieldLabel, { color: colors.destructive }]}>
                      Erreurs ({file.summary.errors.length})
                    </Text>
                    {file.summary.errors.map((err, i) => (
                      <Text
                        key={i}
                        style={{
                          color: colors.foreground,
                          fontSize: 12,
                          fontFamily: 'Inter_400Regular',
                          lineHeight: 17,
                        }}
                      >
                        • {err.message}
                        {err.context ? ` (« ${err.context} »)` : ''}
                      </Text>
                    ))}
                  </View>
                )}

                {file.summary.warnings.length > 0 && (
                  <View style={{ marginTop: 12, gap: 4 }}>
                    <Text style={[styles.fieldLabel, { color: '#F5A623' }]}>
                      Avertissements ({file.summary.warnings.length})
                    </Text>
                    {file.summary.warnings.map((w, i) => (
                      <Text
                        key={i}
                        style={{
                          color: colors.foreground,
                          fontSize: 12,
                          fontFamily: 'Inter_400Regular',
                        }}
                      >
                        • {w.message}
                      </Text>
                    ))}
                  </View>
                )}
              </ScrollView>
              <View style={styles.modalActions}>
                <Pressable
                  onPress={onClose}
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
                    Fermer
                  </Text>
                </Pressable>
              </View>
            </>
          )}
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
  fieldLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fileMeta: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  fileStatus: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 2,
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
