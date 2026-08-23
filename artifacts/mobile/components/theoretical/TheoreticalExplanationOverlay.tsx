/**
 * Pedagogical explanation overlay — keeps catalog mounted behind.
 */
import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppButton } from '@/components/ui/AppButton';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import type { BilingualExplanation } from '@/lib/theoreticalEndgame/domain/types';

type Props = {
  visible: boolean;
  title: string;
  explanation: BilingualExplanation;
  locale: 'fr' | 'en';
  onPlay: () => void;
  onClose: () => void;
};

export function TheoreticalExplanationOverlay({
  visible,
  title,
  explanation,
  locale,
  onPlay,
  onClose,
}: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const copy = explanation[locale] ?? explanation.fr;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]} testID="theoretical-explanation-overlay">
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
              {title}
            </Text>
            <Pressable onPress={onClose} hitSlop={10} testID="theoretical-explanation-close-x">
              <Text style={{ color: colors.mutedForeground, fontSize: 18 }}>✕</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            <Section label={t('quiz.theoreticalExplainPrinciple')} text={copy.principle} colors={colors} />
            <Section label={t('quiz.theoreticalExplainSeek')} text={copy.seek} colors={colors} />
            <Section label={t('quiz.theoreticalExplainMethod')} text={copy.method} colors={colors} />
            <Section label={t('quiz.theoreticalExplainAvoid')} text={copy.avoid} colors={colors} />
          </ScrollView>

          <View style={styles.actions}>
            <AppButton
              label={t('quiz.theoreticalExplainPlay')}
              onPress={onPlay}
              testID="theoretical-explanation-play"
            />
            <AppButton
              label={t('quiz.theoreticalExplainClose')}
              onPress={onClose}
              variant="secondary"
              testID="theoretical-explanation-close"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Section({
  label,
  text,
  colors,
}: {
  label: string;
  text: string;
  colors: { foreground: string; mutedForeground: string };
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.sectionText, { color: colors.foreground }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: DesignTokens.radius.lg,
    borderTopRightRadius: DesignTokens.radius.lg,
    paddingTop: DesignTokens.spacing.md,
    paddingHorizontal: DesignTokens.spacing.md,
    paddingBottom: DesignTokens.spacing.lg,
    gap: DesignTokens.spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: DesignTokens.spacing.sm,
  },
  title: {
    flex: 1,
    fontFamily: DesignTokens.typography.weightSemiBold,
    fontSize: 18,
  },
  body: {
    gap: DesignTokens.spacing.md,
    paddingVertical: DesignTokens.spacing.sm,
  },
  section: { gap: 4 },
  sectionLabel: {
    fontSize: 12,
    fontFamily: DesignTokens.typography.weightSemiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionText: {
    fontSize: 15,
    lineHeight: 22,
  },
  actions: {
    gap: DesignTokens.spacing.sm,
  },
});
