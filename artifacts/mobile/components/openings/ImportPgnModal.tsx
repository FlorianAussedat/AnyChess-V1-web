import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import type { RepertoireSide, StoredPgnFile } from '@/lib/repertoire';
import { RepertoireSidePicker } from '@/components/RepertoireSidePicker';

type Props = {
  visible: boolean;
  replaceTarget: StoredPgnFile | null;
  filename: string;
  onFilenameChange: (value: string) => void;
  pgnText: string;
  onPgnTextChange: (value: string) => void;
  busy: boolean;
  formError: string | null;
  showSidePicker: boolean;
  importSide: RepertoireSide | null;
  onImportSideChange: (side: RepertoireSide) => void;
  lastImportResult: StoredPgnFile | null;
  onPickFile: () => void;
  onCancel: () => void;
  onSubmit: () => void;
  onRequestClose: () => void;
};

export function ImportPgnModal({
  visible,
  replaceTarget,
  filename,
  onFilenameChange,
  pgnText,
  onPgnTextChange,
  busy,
  formError,
  showSidePicker,
  importSide,
  onImportSideChange,
  lastImportResult,
  onPickFile,
  onCancel,
  onSubmit,
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
        <View
          style={[
            styles.modalCard,
            { backgroundColor: colors.card, borderColor: colors.border, maxHeight: '90%' },
          ]}
        >
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>
            {replaceTarget ? 'Remplacer le PGN' : 'Importer un PGN'}
          </Text>

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
            Nom du fichier
          </Text>
          <TextInput
            value={filename}
            onChangeText={onFilenameChange}
            placeholder="lignes.pgn"
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.modalInput,
              {
                backgroundColor: colors.input,
                color: colors.foreground,
                borderColor: colors.border,
              },
            ]}
            editable={!busy}
          />

          <View style={styles.pgnHeaderRow}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
              Contenu PGN
            </Text>
            <Pressable onPress={onPickFile} hitSlop={6} testID="pick-pgn-file-btn">
              <Text style={{ color: colors.primary, fontFamily: 'Inter_500Medium', fontSize: 12 }}>
                Choisir un fichier…
              </Text>
            </Pressable>
          </View>
          <TextInput
            value={pgnText}
            onChangeText={onPgnTextChange}
            placeholder={'[Event "…"]\n1. e4 e5 2. Nf3 …'}
            placeholderTextColor={colors.mutedForeground}
            multiline
            textAlignVertical="top"
            style={[
              styles.pgnInput,
              {
                backgroundColor: colors.input,
                color: colors.foreground,
                borderColor: colors.border,
              },
            ]}
            editable={!busy}
          />

          {!!formError && (
            <Text style={[styles.modalError, { color: colors.destructive }]}>{formError}</Text>
          )}

          {showSidePicker && (
            <>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 4 }]}>
                De quel côté jouez-vous ce répertoire ?
              </Text>
              <RepertoireSidePicker
                value={importSide}
                onChange={onImportSideChange}
                disabled={busy}
              />
            </>
          )}

          {lastImportResult && (
            <View
              style={[
                styles.resultBox,
                {
                  borderColor: lastImportResult.summary.parseSucceeded
                    ? '#27AE60'
                    : colors.destructive,
                },
              ]}
            >
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium', fontSize: 13 }}>
                {lastImportResult.summary.parseSucceeded
                  ? `Importé : ${lastImportResult.summary.gameCount} partie(s), ${lastImportResult.summary.positionCount} position(s)`
                  : 'Aucune position valide importée'}
              </Text>
              {lastImportResult.summary.errors.slice(0, 3).map((err, i) => (
                <Text
                  key={i}
                  style={{ color: colors.destructive, fontSize: 11, fontFamily: 'Inter_400Regular' }}
                >
                  • {err.message}
                </Text>
              ))}
            </View>
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
              disabled={
                busy ||
                !pgnText.trim() ||
                (showSidePicker && !importSide)
              }
              style={({ pressed }) => [
                styles.modalBtn,
                {
                  backgroundColor: colors.primary,
                  borderColor: colors.primary,
                  opacity:
                    pressed ||
                    busy ||
                    !pgnText.trim() ||
                    (showSidePicker && !importSide)
                      ? 0.6
                      : 1,
                },
              ]}
              testID="confirm-import-btn"
            >
              <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold' }}>
                {busy ? 'Analyse…' : replaceTarget ? 'Remplacer' : 'Importer'}
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
  fieldLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pgnHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalInput: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  pgnInput: {
    minHeight: 160,
    maxHeight: 260,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'Inter_400Regular',
  },
  modalError: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  resultBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 4,
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
