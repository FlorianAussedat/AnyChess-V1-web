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
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useTranslation } from '@/hooks/useTranslation';
import { useRepertoireLibrary } from '@/hooks/useRepertoireLibrary';
import { isFileVisibleInLearning, pgnFileDisplayName } from '@/lib/repertoire';
import { ScreenHeader } from '@/components/ScreenHeader';
import { sideLabel } from '@/components/RepertoireSidePicker';

export default function LearnFolderScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { contentTop, contentBottom } = useAppSafeInsets();
  const router = useRouter();
  const { folderId } = useLocalSearchParams<{ folderId: string }>();
  const { ready, getFolder, getFiles } = useRepertoireLibrary();

  const folder = folderId ? getFolder(folderId) : null;
  const files = useMemo(
    () => (folderId ? getFiles(folderId).filter(isFileVisibleInLearning) : []),
    [folderId, getFiles],
  );

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
      <ScreenHeader
        onBack={() => router.back()}
        title={folder?.name ?? t('openings.folderMissing')}
        subtitle={
          folder?.side
            ? `${sideLabel(folder.side)} · ${t('openings.learnPgns')}`
            : t('openings.learnPgns')
        }
      />

      {!ready ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {files.map((file) => (
            <Pressable
              key={file.id}
              onPress={() =>
                router.push(`/openings/study?fileId=${encodeURIComponent(file.id)}` as Href)
              }
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
              testID={`learn-pgn-${file.id}`}
            >
              <Ionicons name="document-text-outline" size={20} color={colors.primary} />
              <View style={styles.body}>
                <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
                  {pgnFileDisplayName(file)}
                </Text>
                <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                  {t('openings.linesShort', { count: file.summary.branchCount })}
                  {file.enabled === false ? ` · ${t('openings.folderInactive')}` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 14, gap: 12 },
  list: { gap: 10, paddingBottom: 20 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  body: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  meta: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
