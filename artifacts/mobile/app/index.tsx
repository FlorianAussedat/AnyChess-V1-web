/**
 * AnyChess main home / menu — premium dark redesign (Major Update 0.0.4).
 * Layout/styling only; routes and modes unchanged.
 *
 * Header proportions match the reference mockup:
 * compact row — brand left, settings right (~1/8 viewport).
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

  // Horizontal logo is 1536×1024 — keep header slim like the mockup.
  const logoHeight = 52;
  const logoMaxWidth = Math.round(logoHeight * (1536 / 1024));
  const logoWidth = Math.min(
    width - DesignTokens.spacing.screenX * 2 - DesignTokens.minTouchTarget - 12,
    logoMaxWidth,
  );

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.root,
        {
          paddingTop: topPad + DesignTokens.spacing.sm,
          paddingBottom: bottomPad + DesignTokens.spacing.md,
        },
      ]}
      showsVerticalScrollIndicator={false}
      testID="home-scroll"
    >
      <View style={styles.headerBlock}>
        <View style={styles.headerRow}>
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
          <SettingsButton />
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
    gap: DesignTokens.spacing.md,
  },
  headerBlock: {
    marginBottom: DesignTokens.spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  brand: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 4,
    paddingTop: 2,
  },
  tagline: {
    fontSize: DesignTokens.typography.tagline,
    fontFamily: 'Inter_500Medium',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginLeft: 2,
  },
  cards: {
    gap: DesignTokens.spacing.cardGap,
  },
  version: {
    marginTop: DesignTokens.spacing.xs,
    textAlign: 'center',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    letterSpacing: 0.2,
  },
});
