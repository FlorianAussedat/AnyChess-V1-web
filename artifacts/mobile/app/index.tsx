/**
 * AnyChess main home / menu — premium dark redesign (Major Update 0.0.4).
 * Routes and modes unchanged; presentation only.
 */
import React from 'react';
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { formatAppVersionLabel } from '@/lib/app/version';
import { BrandAssets, modeCardIllustration } from '@/constants/BrandAssets';
import { DesignTokens } from '@/constants/designTokens';
import { MAIN_MODE_CARD_META } from '@/lib/app/mainModeCards';
import { ModeCard } from '@/components/home/ModeCard';
import { SettingsButton } from '@/components/navigation/SettingsButton';

export default function MainMenu() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.root,
        {
          paddingTop: topPad + DesignTokens.spacing.md,
          paddingBottom: bottomPad + DesignTokens.spacing.xl,
        },
      ]}
      showsVerticalScrollIndicator={false}
      testID="home-scroll"
    >
      <View style={styles.headerRow}>
        <View style={styles.headerSpacer} />
        <SettingsButton />
      </View>

      <View style={styles.brand}>
        <Image
          source={BrandAssets.logoMark}
          style={styles.logo}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
        <Text style={styles.titleRow} accessibilityRole="header">
          <Text style={[styles.titleAny, { color: colors.foreground }]}>Any</Text>
          <Text style={[styles.titleChess, { color: colors.primary }]}>Chess</Text>
        </Text>
        <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
          JOUER. APPRENDRE. VISUALISER.
        </Text>
      </View>

      <View style={styles.cards}>
        {MAIN_MODE_CARD_META.map((mode) => (
          <ModeCard
            key={mode.id}
            title={mode.title}
            description={mode.description}
            iconName={mode.iconName}
            illustration={modeCardIllustration(mode.id)}
            onPress={() => router.push(mode.route)}
            testID={`menu-${mode.id}`}
          />
        ))}
      </View>

      <Text
        style={[styles.version, { color: colors.mutedForeground }]}
        accessibilityLabel={formatAppVersionLabel()}
        testID="app-version-label"
      >
        {formatAppVersionLabel()}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: DesignTokens.spacing.screenX,
    gap: DesignTokens.spacing.xxl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    minHeight: DesignTokens.minTouchTarget,
  },
  headerSpacer: { flex: 1 },
  brand: {
    alignItems: 'center',
    gap: DesignTokens.spacing.sm,
    marginTop: -DesignTokens.spacing.sm,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: DesignTokens.radius.lg,
  },
  titleRow: {
    marginTop: 2,
  },
  titleAny: {
    fontSize: DesignTokens.typography.brand,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.4,
  },
  titleChess: {
    fontSize: DesignTokens.typography.brand,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.4,
  },
  tagline: {
    fontSize: DesignTokens.typography.tagline,
    fontFamily: 'Inter_500Medium',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  cards: {
    gap: DesignTokens.spacing.lg,
  },
  version: {
    marginTop: DesignTokens.spacing.sm,
    textAlign: 'center',
    fontSize: DesignTokens.typography.caption,
    fontFamily: 'Inter_400Regular',
    letterSpacing: 0.2,
  },
});
