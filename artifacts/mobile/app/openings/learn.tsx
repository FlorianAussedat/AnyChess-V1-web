import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useTranslation } from '@/hooks/useTranslation';
import { useRepertoireLibrary } from '@/hooks/useRepertoireLibrary';
import { useOpeningMastery } from '@/hooks/useOpeningMastery';
import { useLearningPgnList } from '@/hooks/useLearningPgnList';
import { ScreenHeader } from '@/components/ScreenHeader';
import { LearningMasteryFilters, emptyFilterCopy } from '@/components/openings/LearningMasteryFilters';
import { LearningPgnCard } from '@/components/openings/LearningPgnCard';
import { DesignTokens } from '@/constants/designTokens';

export default function OpeningsLearnScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { contentTop, contentBottom } = useAppSafeInsets();
  const router = useRouter();
  const { ready, folders, getAllFiles, setFilePriority } = useRepertoireLibrary();
  const mastery = useOpeningMastery();
  const files = useMemo(() => getAllFiles(), [getAllFiles]);
  const { filter, setFilter, visible, counts } = useLearningPgnList(
    folders,
    files,
    mastery.tick,
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
        title={t('openings.learn')}
        subtitle={t('openings.learnPgns')}
      />

      {!ready ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          <LearningMasteryFilters value={filter} counts={counts} onChange={setFilter} />
          {visible.length === 0 ? (
            <Text
              style={[styles.empty, { color: colors.mutedForeground }]}
              testID="learn-filter-empty"
            >
              {t(emptyFilterCopy(filter))}
            </Text>
          ) : (
            visible.map((item) => (
              <LearningPgnCard
                key={item.id}
                view={item}
                folderName={item.folder?.name}
                onPress={() =>
                  router.push(`/openings/study?fileId=${encodeURIComponent(item.id)}` as Href)
                }
                onTogglePriority={() => {
                  void setFilePriority(item.id, !item.priority);
                }}
                testID={`learn-pgn-${item.id}`}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 14, gap: 12 },
  list: { gap: 10, paddingBottom: 20 },
  empty: {
    fontSize: 14,
    fontFamily: DesignTokens.typography.weightRegular,
    textAlign: 'center',
    paddingVertical: 28,
    lineHeight: 20,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
