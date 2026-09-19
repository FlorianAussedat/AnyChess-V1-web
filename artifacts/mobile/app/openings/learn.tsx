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
import { isFileVisibleInLearning } from '@/lib/repertoire';
import { ScreenHeader } from '@/components/ScreenHeader';
import { sideLabel } from '@/components/RepertoireSidePicker';

export default function OpeningsLearnScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { contentTop, contentBottom } = useAppSafeInsets();
  const router = useRouter();
  const { ready, folders, getFiles } = useRepertoireLibrary();

  const sections = useMemo(() => {
    const white = folders.filter((f) => f.side === 'white');
    const black = folders.filter((f) => f.side === 'black');
    const other = folders.filter((f) => !f.side);
    return [
      { title: t('openings.sectionWhite'), folders: white },
      { title: t('openings.sectionBlack'), folders: black },
      { title: t('openings.sectionUnassigned'), folders: other },
    ].filter((s) => s.folders.length > 0);
  }, [folders, t]);

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
        title={t('openings.learn')}
        subtitle={t('openings.learnFolders')}
      />

      {!ready ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
                {section.title}
              </Text>
              {section.folders.map((folder) => {
                const files = getFiles(folder.id).filter(isFileVisibleInLearning);
                return (
                  <Pressable
                    key={folder.id}
                    onPress={() => router.push(`/openings/${folder.id}` as Href)}
                    style={({ pressed }) => [
                      styles.card,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}
                    testID={`learn-folder-${folder.id}`}
                  >
                    <View style={[styles.icon, { backgroundColor: colors.primary }]}>
                      <Ionicons name="folder" size={20} color={colors.primaryForeground} />
                    </View>
                    <View style={styles.body}>
                      <Text style={[styles.name, { color: colors.foreground }]}>{folder.name}</Text>
                      <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                        {folder.side ? sideLabel(folder.side) : t('openings.setSide')}
                        {' · '}
                        {t('openings.pgnFileCount', { count: files.length })}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
                  </Pressable>
                );
              })}
            </View>
          ))}
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
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  meta: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
