/**
 * Expandable openings tree for Gérer.
 * One scroll parent: rows indent in place, folders stay above studies.
 */
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { RepertoireSidePicker, sideLabel } from '@/components/RepertoireSidePicker';
import { requestPgnExport } from '@/lib/files/presentChessExport';
import {
  flattenOpeningTree,
  hasAssignedRepertoireSide,
  isUnfiledOpeningFolder,
  openingTreeIndent,
  pgnFileDisplayName,
  type RepertoireFolder,
  type RepertoireSide,
  type StoredPgnFile,
} from '@/lib/repertoire';

type Props = {
  roots: RepertoireFolder[];
  folders: RepertoireFolder[];
  files: StoredPgnFile[];
  expanded: ReadonlySet<string>;
  onToggle: (folderId: string) => void;
  selecting: boolean;
  selectedFileIds: ReadonlySet<string>;
  onToggleSelected: (fileId: string) => void;
  onCreateSubfolder: (folder: RepertoireFolder) => void;
  onRenameFolder: (folder: RepertoireFolder) => void;
  onMoveFolder: (folder: RepertoireFolder) => void;
  onDeleteFolder: (folder: RepertoireFolder) => void;
  onSetSide: (folderId: string, side: RepertoireSide) => void;
  onSetFolderEnabled: (folderId: string, enabled: boolean) => void;
  onSetFileEnabled: (fileId: string, enabled: boolean) => void;
  onRenameFile: (file: StoredPgnFile) => void;
  onMoveFile: (file: StoredPgnFile) => void;
  onDeleteFile: (file: StoredPgnFile) => void;
};

export function ManageOpeningTree({
  roots,
  folders,
  files,
  expanded,
  onToggle,
  selecting,
  selectedFileIds,
  onToggleSelected,
  onCreateSubfolder,
  onRenameFolder,
  onMoveFolder,
  onDeleteFolder,
  onSetSide,
  onSetFolderEnabled,
  onSetFileEnabled,
  onRenameFile,
  onMoveFile,
  onDeleteFile,
}: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const rows = useMemo(
    () => flattenOpeningTree(folders, files, roots, expanded),
    [expanded, files, folders, roots],
  );

  return (
    <View style={styles.list}>
      {rows.map((row) => {
        if (row.kind === 'file') {
          const folder = folders.find((item) => item.id === row.file.folderId);
          if (!folder) return null;
          const file = row.file;
          const active = folder.enabled !== false && file.enabled !== false;
          const name = pgnFileDisplayName(file);
          const selected = selectedFileIds.has(file.id);
          return (
            <View
              key={file.id}
              style={[
                styles.pgnRow,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.secondary,
                  marginLeft: openingTreeIndent(row.depth),
                },
              ]}
              testID={`manage-pgn-${file.id}`}
            >
              <View style={styles.pgnTop}>
                {selecting ? (
                  <Pressable
                    onPress={() => onToggleSelected(file.id)}
                    hitSlop={8}
                    style={styles.checkHit}
                    testID={`select-pgn-${file.id}`}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                  >
                    <Ionicons
                      name={selected ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={selected ? colors.primary : colors.mutedForeground}
                    />
                  </Pressable>
                ) : (
                  <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                )}
                <View style={styles.pgnMain}>
                  <Text style={[styles.pgnName, { color: colors.foreground }]} numberOfLines={2}>
                    {name}
                  </Text>
                  <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                    {active ? t('openings.folderActive') : t('openings.folderInactive')}
                    {' · '}
                    {t('openings.linesShort', { count: file.summary.branchCount })}
                  </Text>
                </View>
                <Switch
                  value={file.enabled !== false}
                  onValueChange={(value) => onSetFileEnabled(file.id, value)}
                  testID={`toggle-pgn-${file.id}`}
                />
              </View>
              <View style={styles.pgnActions}>
                <Pressable
                  onPress={() =>
                    router.push(`/openings/study?fileId=${encodeURIComponent(file.id)}` as Href)
                  }
                  hitSlop={8}
                  style={styles.iconHit}
                  testID={`view-pgn-${file.id}`}
                  accessibilityLabel={t('openings.viewPgn')}
                >
                  <Ionicons name="eye-outline" size={18} color={colors.primary} />
                </Pressable>
                <Pressable
                  onPress={() =>
                    router.push(`/openings/annotate?fileId=${encodeURIComponent(file.id)}` as Href)
                  }
                  hitSlop={8}
                  style={styles.iconHit}
                  testID={`annotate-pgn-${file.id}`}
                  accessibilityLabel={t('openings.annotatePgn')}
                >
                  <Ionicons name="create-outline" size={18} color={colors.primary} />
                </Pressable>
                <Pressable
                  onPress={() => onRenameFile(file)}
                  hitSlop={8}
                  style={styles.iconHit}
                  testID={`rename-pgn-${file.id}`}
                >
                  <Ionicons name="pencil-outline" size={18} color={colors.mutedForeground} />
                </Pressable>
                <Pressable
                  onPress={() => onMoveFile(file)}
                  hitSlop={8}
                  style={styles.iconHit}
                  testID={`move-pgn-${file.id}`}
                >
                  <Ionicons name="folder-outline" size={18} color={colors.mutedForeground} />
                </Pressable>
                <Pressable
                  onPress={() => void requestPgnExport(file.filename, file.pgnText)}
                  hitSlop={8}
                  style={styles.iconHit}
                  testID={`export-pgn-${file.id}`}
                  accessibilityLabel={t('openings.exportPgn')}
                >
                  <Ionicons name="download-outline" size={18} color={colors.mutedForeground} />
                </Pressable>
                <Pressable
                  onPress={() => onDeleteFile(file)}
                  hitSlop={8}
                  style={styles.iconHit}
                  testID={`delete-pgn-${file.id}`}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                </Pressable>
              </View>
            </View>
          );
        }

        const folder = row.folder;
        const unfiled = isUnfiledOpeningFolder(folder);
        const folderOn = folder.enabled !== false;
        const label = unfiled ? t('openings.toClassify') : folder.name;
        return (
          <View
            key={folder.id}
            style={[
              styles.folderCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                marginLeft: openingTreeIndent(row.depth),
              },
            ]}
            testID={`manage-folder-${folder.id}`}
          >
            <View style={[styles.folderHeader, unfiled ? styles.compactFolderHeader : null]}>
              <Pressable
                onPress={() => onToggle(folder.id)}
                accessibilityRole="button"
                accessibilityState={{ expanded: row.expanded }}
                accessibilityLabel={
                  row.expanded
                    ? t('openings.collapseFolder', { name: label })
                    : t('openings.expandFolder', { name: label })
                }
                hitSlop={6}
                style={styles.chevronHit}
                testID={`folder-expand-${folder.id}`}
              >
                <Ionicons
                  name={row.expanded ? 'chevron-down' : 'chevron-forward'}
                  size={18}
                  color={colors.mutedForeground}
                />
              </Pressable>
              <Pressable
                onPress={() => onToggle(folder.id)}
                accessibilityRole="button"
                style={styles.folderMain}
              >
                <View style={[styles.folderIcon, { backgroundColor: colors.primary }]}>
                  <Ionicons name="folder" size={20} color={colors.primaryForeground} />
                </View>
                <View style={styles.folderBody}>
                  <Text
                    style={[styles.folderName, { color: colors.foreground }]}
                    numberOfLines={2}
                  >
                    {label}
                  </Text>
                  <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                    {unfiled
                      ? t('openings.pgnFileCount', { count: row.directFileCount })
                      : hasAssignedRepertoireSide(folder.side)
                        ? sideLabel(folder.side)
                        : t('openings.chooseWhiteOrBlack')}
                    {!unfiled ? ' · ' : ''}
                    {!unfiled
                      ? t('openings.treeContents', {
                          folders: row.directFolderCount,
                          files: row.directFileCount,
                        })
                      : ''}
                  </Text>
                </View>
              </Pressable>
            </View>

            {unfiled && row.expanded ? (
              <Text style={[styles.hint, { color: colors.mutedForeground }]} testID="openings-unfiled-hint">
                {t('openings.unfiledHint')}
              </Text>
            ) : null}
            {!unfiled && !hasAssignedRepertoireSide(folder.side) ? (
              <Text
                style={[styles.hint, { color: colors.destructive }]}
                testID={`manage-folder-classify-${folder.id}`}
              >
                {t('openings.unassignedSideHint')}
              </Text>
            ) : null}

            {!unfiled && row.expanded ? (
              <View style={styles.folderTools}>
                {row.depth === 0 ? (
                  <RepertoireSidePicker
                    value={folder.side ?? null}
                    onChange={(side) => onSetSide(folder.id, side)}
                  />
                ) : null}
                <View style={styles.toolRow}>
                  <Text style={[styles.meta, { color: colors.foreground, flex: 1 }]}>
                    {t('openings.toggleReview')}
                  </Text>
                  <Switch
                    value={folderOn}
                    onValueChange={(value) => onSetFolderEnabled(folder.id, value)}
                    testID={`toggle-folder-${folder.id}`}
                  />
                  <Pressable
                    onPress={() => onCreateSubfolder(folder)}
                    hitSlop={8}
                    style={styles.iconHit}
                    testID={`create-subfolder-${folder.id}`}
                    accessibilityLabel={t('openings.createSubfolder')}
                  >
                    <Ionicons name="add" size={20} color={colors.primary} />
                  </Pressable>
                  <Pressable
                    onPress={() => onMoveFolder(folder)}
                    hitSlop={8}
                    style={styles.iconHit}
                    testID={`move-folder-${folder.id}`}
                    accessibilityLabel={t('openings.moveFolder')}
                  >
                    <Ionicons name="arrow-forward" size={18} color={colors.mutedForeground} />
                  </Pressable>
                  <Pressable
                    onPress={() => onRenameFolder(folder)}
                    hitSlop={8}
                    style={styles.iconHit}
                    testID={`rename-folder-${folder.id}`}
                  >
                    <Ionicons name="pencil-outline" size={18} color={colors.mutedForeground} />
                  </Pressable>
                  <Pressable
                    onPress={() => onDeleteFolder(folder)}
                    hitSlop={8}
                    style={styles.iconHit}
                    testID={`delete-folder-${folder.id}`}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  folderCard: { borderRadius: 14, borderWidth: 1, padding: 10, gap: 8 },
  folderHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 48 },
  compactFolderHeader: { minHeight: 48 },
  chevronHit: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  folderIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderBody: { flex: 1, gap: 2, minWidth: 0 },
  folderName: { fontSize: 15, lineHeight: 20, fontFamily: 'Inter_600SemiBold' },
  meta: { fontSize: 12, lineHeight: 16, fontFamily: 'Inter_400Regular' },
  hint: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  folderTools: { gap: 8 },
  toolRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pgnRow: { borderRadius: 10, borderWidth: 1, padding: 10, gap: 8 },
  pgnTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pgnMain: { flex: 1, gap: 2, minWidth: 0 },
  pgnName: { fontSize: 14, lineHeight: 18, fontFamily: 'Inter_600SemiBold' },
  pgnActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  iconHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  checkHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
