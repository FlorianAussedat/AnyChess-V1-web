/**
 * AnyChess main home / menu — premium dark redesign (Major Update 0.0.4).
 * Layout/styling only; routes and modes unchanged.
 */
import React from 'react';
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
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
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom;

  // Horizontal logo is 1536×1024 — keep header compact (~110–135 with tagline/settings).
  const logoHeight = 64;
  const logoWidth = Math.min(
    width - DesignTokens.spacing.screenX * 2 - 8,
    Math.round(logoHeight * (1536 / 1024)),
  );

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.root,
        {
          paddingTop: topPad + DesignTokens.spacing.sm,
          paddingBottom: bottomPad + DesignTokens.spacing.lg,
        },
      ]}
      showsVerticalScrollIndicator={false}
      testID="home-scroll"
    >
      <View style={styles.headerBlock}>
        <View style={styles.headerTop}>
          <View style={styles.headerSpacer} />
          <SettingsButton />
        </View>

        <View style={styles.brand}>
          <Image
            source={BrandAssets.horizontalLogo}
            style={{ width: logoWidth, height: logoHeight }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
            accessibilityLabel="AnyChess"
            testID="home-horizontal-logo"
          />
          <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
            JOUER. APPRENDRE. VISUALISER.
          </Text>
        </View>
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
    gap: DesignTokens.spacing.lg,
  },
  headerBlock: {
    gap: DesignTokens.spacing.xs,
    marginBottom: DesignTokens.spacing.xs,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    minHeight: DesignTokens.minTouchTarget - 4,
  },
  headerSpacer: { flex: 1 },
  brand: {
    alignItems: 'center',
    gap: 6,
    marginTop: -4,
  },
  tagline: {
    fontSize: DesignTokens.typography.tagline,
    fontFamily: 'Inter_500Medium',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  cards: {
    gap: DesignTokens.spacing.cardGap,
  },
  version: {
    marginTop: DesignTokens.spacing.sm,
    textAlign: 'center',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    letterSpacing: 0.2,
  },
});
