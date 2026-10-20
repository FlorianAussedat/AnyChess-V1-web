/**
 * Pick an openings repertoire folder (or create one first).
 * Used by root PGN import and Bibliothèque → Ouvertures bridge.
 */
import React, { useMemo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import {
  collectDescendantFolderIds,
  flattenOpeningFoldersDepthFirst,
  hasAssignedRepertoireSide,
  isOpeningFolderRoot,
  isUnfiledOpeningFolder,
  openingTreeIndent,
  type RepertoireFolder,
  type RepertoireSide,
} from '@/lib/repertoire';
import { sideLabel } from '@/components/RepertoireSidePicker';

type Props = {
  visible: boolean;
  folders: RepertoireFolder[];
  title?: string;
  /** Exclude this folder id (e.g. when moving a study out of its current folder). */
  excludeFolderId?: string | null;
  /** Folder being moved: itself and its descendants cannot be targets. */
  movingFolderId?: string | null;
  /** Offer White / Black roots when moving a folder. */
  showRootTargets?: boolean;
  busy?: boolean;
  onSelect: (folderId: string) => void;
  onSelectRoot?: (side: RepertoireSide) => void;
  onCreateFolder: () => void;
  onCancel: () => void;
};

export function FolderPickModal({
  visible,
  folders,
  title,
  excludeFolderId,
  movingFolderId,
  showRootTargets = false,
  busy = false,
  onSelect,
  onSelectRoot,
  onCreateFolder,
  onCancel,
}: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const visibleFolders = useMemo(() => {
    const blocked = new Set(
      movingFolderId ? collectDescendantFolderIds(folders, movingFolderId) : [],
    );
    return folders.filter((folder) => !blocked.has(folder.id));
  }, [folders, movingFolderId]);
  const sections = useMemo(() => {
    const groups: { key: string; title: string | null; roots: RepertoireFolder[] }[] = [
      {
        key: 'white',
        title: t('openings.sectionWhite'),
        roots: visibleFolders.filter(
          (folder) => folder.side === 'white' && isOpeningFolderRoot(folder) && !isUnfiledOpeningFolder(folder),
        ),
      },
      {
        key: 'black',
        title: t('openings.sectionBlack'),
        roots: visibleFolders.filter(
          (folder) => folder.side === 'black' && isOpeningFolderRoot(folder) && !isUnfiledOpeningFolder(folder),
        ),
      },
      {
        key: 'unfiled',
        title: null,
        roots: visibleFolders.filter((folder) => isUnfiledOpeningFolder(folder)),
      },
      {
        key: 'unassigned',
        title: t('openings.sectionUnassigned'),
        roots: visibleFolders.filter(
          (folder) =>
            !hasAssignedRepertoireSide(folder.side) &&
            isOpeningFolderRoot(folder) &&
            !isUnfiledOpeningFolder(folder),
        ),
      },
    ];
    return groups.filter((group) => group.roots.length > 0);
  }, [t, visibleFolders]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          testID="openings-folder-pick"
        >
          <Text style={[styles.title, { color: colors.foreground }]}>
            {title ?? t('openings.pickFolderTitle')}
          </Text>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            {t('openings.pickFolderHint')}
          </Text>

          {sections.length === 0 && !showRootTargets ? (
            <Text style={[styles.empty, { color: colors.mutedForeground }]}>
              {t('openings.pickFolderEmpty')}
            </Text>
          ) : (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {showRootTargets && onSelectRoot ? (
                <View style={styles.section}>
                  <Pressable
                    testID="openings-folder-pick-root-white"
                    disabled={busy}
                    onPress={() => onSelectRoot('white')}
                    style={({ pressed }) => [
                      styles.row,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.secondary,
                        opacity: pressed || busy ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.rowTitle, { color: colors.foreground }]} numberOfLines={2}>
                      {t('openings.moveToRootWhite')}
                    </Text>
                  </Pressable>
                  <Pressable
                    testID="openings-folder-pick-root-black"
                    disabled={busy}
                    onPress={() => onSelectRoot('black')}
                    style={({ pressed }) => [
                      styles.row,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.secondary,
                        opacity: pressed || busy ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.rowTitle, { color: colors.foreground }]} numberOfLines={2}>
                      {t('openings.moveToRootBlack')}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
              {sections.map((section) => (
                <View key={section.key} style={styles.section}>
                  {section.title ? (
                    <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
                      {section.title}
                    </Text>
                  ) : null}
                  {flattenOpeningFoldersDepthFirst(visibleFolders, section.roots).map(({ folder, depth }) => {
                    if (folder.id === excludeFolderId) return null;
                    return (
                    <Pressable
                      key={folder.id}
                      testID={`openings-folder-pick-${folder.id}`}
                      disabled={busy}
                      onPress={() => onSelect(folder.id)}
                      style={({ pressed }) => [
                        styles.row,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.secondary,
                          marginLeft: openingTreeIndent(depth),
                          opacity: pressed || busy ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[styles.rowTitle, { color: colors.foreground }]}
                        numberOfLines={2}
                      >
                        {isUnfiledOpeningFolder(folder) ? t('openings.toClassify') : folder.name}
                      </Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                        {hasAssignedRepertoireSide(folder.side)
                          ? sideLabel(folder.side)
                          : `${t('openings.toClassify')} · ${t('openings.chooseWhiteOrBlack')}`}
                      </Text>
                    </Pressable>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          )}

          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              disabled={busy}
              style={[styles.btn, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.foreground }}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              testID="openings-folder-pick-create"
              onPress={onCreateFolder}
              disabled={busy}
              style={[
                styles.btnPrimary,
                { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 },
              ]}
            >
              <Text style={{ color: colors.primaryForeground }}>
                {t('openings.createFolder')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    maxHeight: '85%',
  },
  title: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  hint: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  empty: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    paddingVertical: 16,
  },
  list: { maxHeight: 360 },
  section: { gap: 6, marginBottom: 8 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.6,
  },
  row: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 6,
    gap: 2,
  },
  rowTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  btn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  btnPrimary: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});
