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
import { HubModeCard } from '@/components/HubModeCard';
import { ScreenHeader } from '@/components/ScreenHeader';
import { OpeningEmptyState } from '@/components/openings/OpeningEmptyState';
import { DesignTokens } from '@/constants/designTokens';

export default function OpeningsHub() {
  const colors = useColors();
  const { t } = useTranslation();
  const { contentTop, contentBottom } = useAppSafeInsets();
  const router = useRouter();
  const { ready, folders, error } = useRepertoireLibrary();

  const empty = folders.length === 0;

  const subtitle = useMemo(
    () => t('modes.openings.title'),
    [t],
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
        title={t('openings.title')}
        subtitle={subtitle}
        backTestID="openings-back"
      />

      {!ready ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={[styles.emptyTitle, { color: colors.destructive }]}>{error}</Text>
        </View>
      ) : empty ? (
        <OpeningEmptyState
          onCreateFolder={() => router.push('/openings/manage' as Href)}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          <HubModeCard
            title={t('openings.review')}
            description={t('openings.hubReviewHint')}
            iconName="refresh"
            onPress={() => router.push('/openings/review' as Href)}
            testID="openings-hub-review"
          />
          <HubModeCard
            title={t('openings.learn')}
            description={t('openings.hubLearnHint')}
            iconName="book-outline"
            onPress={() => router.push('/openings/learn' as Href)}
            testID="openings-hub-learn"
          />
        </ScrollView>
      )}

      <Pressable
        onPress={() => router.push('/openings/manage' as Href)}
        style={({ pressed }) => [
          styles.manageBtn,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            opacity: pressed ? 0.75 : 1,
          },
        ]}
        testID="openings-manage-pgn-btn"
      >
        <Ionicons name="folder-open-outline" size={18} color={colors.primary} />
        <Text style={[styles.manageLabel, { color: colors.foreground }]}>
          {t('openings.managePgn')}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 14, gap: 12 },
  list: { gap: 12, paddingBottom: 8, flexGrow: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 28,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  manageLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
});
