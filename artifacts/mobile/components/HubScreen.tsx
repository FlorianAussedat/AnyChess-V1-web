import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useColors } from '@/hooks/useColors';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { DesignTokens } from '@/constants/designTokens';

type Props = {
  title: string;
  subtitle?: string;
  onBack: () => void;
  children: React.ReactNode;
  showSound?: boolean;
};

/**
 * Family A shell — navigation / mode menu screens.
 */
export function HubScreen({ title, subtitle, onBack, children, showSound = false }: Props) {
  const colors = useColors();
  const { top: topPad, bottom: bottomPad } = useAppSafeInsets();

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.root,
        { paddingTop: topPad + 12, paddingBottom: bottomPad + 20 },
      ]}
    >
      <ScreenHeader onBack={onBack} showSound={showSound} />
      <View style={styles.intro}>
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
        ) : null}
      </View>
      <View style={styles.cards}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: DesignTokens.spacing.xl - 2,
    gap: DesignTokens.spacing.lg,
  },
  intro: { gap: DesignTokens.spacing.sm },
  title: {
    fontSize: DesignTokens.typography.title,
    fontFamily: DesignTokens.typography.weightBold,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: DesignTokens.typography.weightRegular,
    lineHeight: 20,
  },
  cards: { gap: DesignTokens.spacing.md },
});
