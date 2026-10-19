import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useTranslation } from '@/hooks/useTranslation';
import { useRepertoireLibrary } from '@/hooks/useRepertoireLibrary';
import { useOpeningTreeExpanded } from '@/hooks/useOpeningTreeExpanded';
import {
  flattenOpeningTree,
  hasAssignedRepertoireSide,
  isOpeningFolderRoot,
  isUnfiledOpeningFolder,
  openingTreeIndent,
  type RepertoireFolder,
} from '@/lib/repertoire';
import { ScreenHeader } from '@/components/ScreenHeader';
import { sideLabel } from '@/components/RepertoireSidePicker';
import { DesignTokens } from '@/constants/designTokens';

export default function OpeningsLearnScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { contentTop, contentBottom } = useAppSafeInsets();
  const router = useRouter();
  const { ready, folders, getSubtreeFiles } = useRepertoireLibrary();
  const { expanded, toggle } = useOpeningTreeExpanded();

  const whiteFolders = useMemo(
    () =>
      folders.filter(
        (folder) =>
          folder.side === 'white' && !isUnfiledOpeningFolder(folder) && isOpeningFolderRoot(folder),
      ),
    [folders],
  );
  const blackFolders = useMemo(
    () =>
      folders.filter(
        (folder) =>
          folder.side === 'black' && !isUnfiledOpeningFolder(folder) && isOpeningFolderRoot(folder),
      ),
    [folders],
  );
  const unassignedFolders = useMemo(
    () =>
      folders.filter(
        (folder) =>
          !hasAssignedRepertoireSide(folder.side) &&
          !isUnfiledOpeningFolder(folder) &&
          isOpeningFolderRoot(folder),
      ),
    [folders],
  );
  const unfiledFolders = useMemo(
    () => folders.filter((folder) => isUnfiledOpeningFolder(folder)),
    [folders],
  );

  const openFolder = (folder: RepertoireFolder) => {
    router.push(`/openings/${encodeURIComponent(folder.id)}` as Href);
  };

  const renderSection = (roots: RepertoireFolder[]) => {
    const rows = flattenOpeningTree(folders, [], roots, expanded);
    return rows.map((row) => {
      if (row.kind !== 'folder') return null;
      const folder = row.folder;
      const count = getSubtreeFiles(folder.id).length;
      const played = isUnfiledOpeningFolder(folder)
        ? t('openings.systemFolder')
        : hasAssignedRepertoireSide(folder.side)
          ? sideLabel(folder.side)
          : t('openings.chooseWhiteOrBlack');
      const label = isUnfiledOpeningFolder(folder) ? t('openings.toClassify') : folder.name;
      return (
        <View
          key={folder.id}
          style={[styles.card, { marginLeft: openingTreeIndent(row.depth), backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Pressable
            onPress={() => toggle(folder.id)}
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
            onPress={() => openFolder(folder)}
            accessibilityRole="button"
            testID={`learn-folder-${folder.id}`}
            style={({ pressed }) => [styles.openHit, { opacity: pressed ? 0.85 : 1 }]}
          >
            <View style={[styles.icon, { backgroundColor: colors.primary }]}>
              <Ionicons name="folder" size={20} color={colors.primaryForeground} />
            </View>
            <View style={styles.body}>
              <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={2}>
                {label}
              </Text>
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                {played}
                {' · '}
                {t('openings.pgnFileCount', { count })}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>
      );
    });
  };

  const sections = [
    { key: 'white', title: t('openings.sectionWhite'), folders: whiteFolders },
    { key: 'black', title: t('openings.sectionBlack'), folders: blackFolders },
    { key: 'unassigned', title: t('openings.sectionUnassigned'), folders: unassignedFolders },
    { key: 'unfiled', title: null, folders: unfiledFolders },
  ].filter((section) => section.folders.length > 0);

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingTop: contentTop,
          paddingBottom: contentBottom,
        },
      ]}
    >
      <ScreenHeader onBack={() => router.back()} title={t('openings.learn')} />

      {!ready ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {sections.length === 0 ? (
            <Text style={[styles.empty, { color: colors.mutedForeground }]}>
              {t('openings.emptyLead')}
            </Text>
          ) : (
            sections.map((section) => (
              <View key={section.key} style={styles.section}>
                {section.title ? (
                  <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
                    {section.title}
                  </Text>
                ) : null}
                {renderSection(section.folders)}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 14, gap: 12 },
  list: { gap: 16, paddingBottom: 20 },
  section: { gap: 10 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: DesignTokens.typography.weightSemiBold,
    letterSpacing: 0.8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 56,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  chevronHit: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openHit: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2, minWidth: 0 },
  name: {
    fontSize: 16,
    lineHeight: 21,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  meta: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: DesignTokens.typography.weightRegular,
  },
  empty: {
    fontSize: 14,
    fontFamily: DesignTokens.typography.weightRegular,
    textAlign: 'center',
    paddingVertical: 28,
    lineHeight: 20,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
