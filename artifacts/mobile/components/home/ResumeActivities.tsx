import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { useInProgressActivities } from '@/hooks/useActivitySessions';
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
        <Pressable
          key={item.id}
          testID={`resume-activity-${item.id}`}
          accessibilityRole="button"
          accessibilityLabel={`${item.title}. ${item.summary}`}
          onPress={() => router.push(item.route as Href)}
          style={({ pressed }) => [
            styles.row,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: pressed ? 0.85 : 1,
            },
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
          <Text style={[styles.cta, { color: colors.primary }]}>{t('activity.resumeCta')}</Text>
          <Ionicons name="play-circle-outline" size={22} color={colors.primary} />
        </Pressable>
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
    gap: 10,
    borderWidth: 1,
    borderRadius: DesignTokens.radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  text: {
    flex: 1,
    gap: 2,
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
  cta: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
});
