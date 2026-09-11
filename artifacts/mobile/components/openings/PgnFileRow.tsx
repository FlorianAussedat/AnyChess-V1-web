import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { pgnFileDisplayName, type StoredPgnFile } from '@/lib/repertoire';
import { formatDate } from '@/components/openings/formatDate';

type Props = {
  file: StoredPgnFile;
  onOpenDetail: (file: StoredPgnFile) => void;
  onToggleEnabled: (file: StoredPgnFile) => void;
  onRename: (file: StoredPgnFile) => void;
  onMove: (file: StoredPgnFile) => void;
  onDelete: (file: StoredPgnFile) => void;
};

export function PgnFileRow({
  file,
  onOpenDetail,
  onToggleEnabled,
  onRename,
  onMove,
  onDelete,
}: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const name = pgnFileDisplayName(file);

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
            {name}
            {file.enabled === false ? ` ${t('openings.disabled')}` : ''}
          </Text>
        </View>
        <Text style={[styles.fileMeta, { color: colors.mutedForeground }]}>
          {t('openings.gamesCount', { count: file.summary.gameCount })}
          {' · '}
          {t('openings.positionsCount', { count: file.summary.positionCount })}
          {file.summary.errors.length > 0
            ? ` · ${t('openings.errorsCount', { count: file.summary.errors.length })}`
            : ''}
        </Text>
        <Text style={[styles.fileMeta, { color: colors.mutedForeground }]}>
          {t('openings.importedOn', { date: formatDate(file.importedAt) })}
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
              ? t('openings.importPartial')
              : t('openings.importSuccess')
            : t('openings.importFailed')}
        </Text>
      </Pressable>
      <View style={styles.fileActions}>
        <Pressable
          onPress={() => onToggleEnabled(file)}
          hitSlop={8}
          style={styles.iconOnly}
          testID={`toggle-pgn-${file.id}`}
          accessibilityLabel={
            file.enabled === false ? t('a11y.pgnEnable') : t('a11y.pgnDisable')
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
          onPress={() => onRename(file)}
          hitSlop={8}
          style={styles.iconOnly}
          testID={`rename-pgn-${file.id}`}
          accessibilityLabel={t('openings.renameDisplayName')}
        >
          <Ionicons name="pencil-outline" size={18} color={colors.mutedForeground} />
        </Pressable>
        <Pressable
          onPress={() => onMove(file)}
          hitSlop={8}
          style={styles.iconOnly}
          testID={`move-pgn-${file.id}`}
          accessibilityLabel={t('openings.moveToFolder')}
        >
          <Ionicons name="folder-outline" size={18} color={colors.mutedForeground} />
        </Pressable>
        <Pressable
          onPress={() => onDelete(file)}
          hitSlop={8}
          style={styles.iconOnly}
          testID={`delete-pgn-${file.id}`}
          accessibilityLabel={t('openings.delete')}
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
