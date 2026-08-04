import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { StoredPgnFile } from '@/lib/repertoire';
import { formatDate } from '@/components/openings/formatDate';

type Props = {
  file: StoredPgnFile;
  onOpenDetail: (file: StoredPgnFile) => void;
  onToggleEnabled: (file: StoredPgnFile) => void;
  onReplace: (file: StoredPgnFile) => void;
  onDelete: (file: StoredPgnFile) => void;
};

export function PgnFileRow({
  file,
  onOpenDetail,
  onToggleEnabled,
  onReplace,
  onDelete,
}: Props) {
  const colors = useColors();

  return (
    <View
      style={[styles.fileCard, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <Pressable
        onPress={() => onOpenDetail(file)}
        style={styles.fileMain}
        testID={`pgn-file-${file.id}`}
      >
        <View style={styles.fileHeader}>
          <Ionicons
            name={file.summary.parseSucceeded ? 'document-text-outline' : 'warning-outline'}
            size={20}
            color={file.summary.parseSucceeded ? colors.primary : '#F5A623'}
          />
          <Text style={[styles.fileName, { color: colors.foreground }]} numberOfLines={1}>
            {file.filename}
            {file.enabled === false ? ' (désactivé)' : ''}
          </Text>
        </View>
        <Text style={[styles.fileMeta, { color: colors.mutedForeground }]}>
          Importé le {formatDate(file.importedAt)}
        </Text>
        <Text style={[styles.fileMeta, { color: colors.mutedForeground }]}>
          {file.summary.gameCount} partie{file.summary.gameCount !== 1 ? 's' : ''}
          {' · '}
          {file.summary.positionCount} position{file.summary.positionCount !== 1 ? 's' : ''}
          {file.summary.errors.length > 0
            ? ` · ${file.summary.errors.length} erreur${file.summary.errors.length > 1 ? 's' : ''}`
            : ''}
        </Text>
        <Text
          style={[
            styles.fileStatus,
            {
              color: file.summary.parseSucceeded
                ? '#27AE60'
                : colors.destructive,
            },
          ]}
        >
          {file.summary.parseSucceeded
            ? file.summary.errors.length > 0
              ? 'Import partiel'
              : 'Import réussi'
            : 'Échec d’import'}
        </Text>
      </Pressable>
      <View style={styles.fileActions}>
        <Pressable
          onPress={() => onToggleEnabled(file)}
          hitSlop={8}
          style={styles.iconOnly}
          testID={`toggle-pgn-${file.id}`}
          accessibilityLabel={
            file.enabled === false ? 'Activer ce PGN' : 'Désactiver ce PGN'
          }
        >
          <Ionicons
            name={file.enabled === false ? 'eye-off-outline' : 'eye-outline'}
            size={18}
            color={
              file.enabled === false ? colors.mutedForeground : colors.primary
            }
          />
        </Pressable>
        <Pressable
          onPress={() => onReplace(file)}
          hitSlop={8}
          style={styles.iconOnly}
          testID={`replace-pgn-${file.id}`}
        >
          <Ionicons name="swap-horizontal-outline" size={18} color={colors.mutedForeground} />
        </Pressable>
        <Pressable
          onPress={() => onDelete(file)}
          hitSlop={8}
          style={styles.iconOnly}
          testID={`delete-pgn-${file.id}`}
        >
          <Ionicons name="trash-outline" size={18} color={colors.destructive} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fileCard: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  fileMain: {
    flex: 1,
    gap: 3,
  },
  fileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fileName: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
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
  fileActions: {
    justifyContent: 'center',
    gap: 10,
  },
  iconOnly: {
    padding: 4,
  },
});
