import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { useInProgressActivities } from '@/hooks/useActivitySessions';
import { confirmQuitFromHome } from '@/lib/activitySessions';
import { DesignTokens } from '@/constants/designTokens';

export function ResumeActivities() {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const items = useInProgressActivities();

  if (items.length === 0) return null;

  return (
    <View style={styles.wrap} testID="resume-activities">
      <Text style={[styles.heading, { color: colors.foreground }]}>
        {t('activity.resumeTitle')}
      </Text>
      {items.map((item) => (
        <View
          key={item.id}
          testID={`resume-activity-${item.id}`}
          style={[
            styles.row,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.text}>
            <Text style={[styles.title, { color: colors.foreground }]}>{item.title}</Text>
            {item.summary ? (
              <Text style={[styles.summary, { color: colors.mutedForeground }]}>
                {item.summary}
              </Text>
            ) : null}
          </View>
          <Pressable
            testID={`resume-activity-quit-${item.id}`}
            accessibilityRole="button"
            accessibilityLabel={t('activity.quitCta')}
            onPress={() => confirmQuitFromHome(item.kind, item.id)}
            style={({ pressed }) => [styles.action, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.quit, { color: colors.mutedForeground }]}>
              {t('activity.quitCta')}
            </Text>
          </Pressable>
          <Pressable
            testID={`resume-activity-resume-${item.id}`}
            accessibilityRole="button"
            accessibilityLabel={t('activity.resumeCta')}
            onPress={() => router.push(item.route as Href)}
            style={({ pressed }) => [styles.action, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.cta, { color: colors.primary }]}>{t('activity.resumeCta')}</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  heading: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: DesignTokens.radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  text: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  title: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  summary: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  action: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  quit: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  cta: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
});
