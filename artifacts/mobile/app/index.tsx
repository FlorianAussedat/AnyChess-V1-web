/**
 * AnyChess main home / menu — premium dark redesign (Major Update 0.0.4).
 * Layout/styling only; routes and modes unchanged.
 *
 * Header: left-aligned horizontal logo. Preferences live under Profil.
 * Tagline text is omitted — the horizontal logo artwork already carries it.
 */
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useTranslation } from '@/hooks/useTranslation';
import { formatAppVersionLabel } from '@/lib/app/version';
import { BrandAssets, modeCardIllustration } from '@/constants/BrandAssets';
import { DesignTokens } from '@/constants/designTokens';
import {
  HORIZONTAL_LOGO_ART,
  artHeight,
  artWidth,
} from '@/constants/brandArtBounds';
import { MAIN_MODE_CARD_META } from '@/lib/app/mainModeCards';
import { ModeCard } from '@/components/home/ModeCard';
import type { MessageKey } from '@/lib/i18n';

export default function MainMenu() {
  const colors = useColors();
  const { top: topPad, bottom: bottomPad } = useAppSafeInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { t } = useTranslation();

  // More prominent logo (~240–290px of VISIBLE artwork).
  const logoArtW = artWidth(HORIZONTAL_LOGO_ART);
  const logoArtH = artHeight(HORIZONTAL_LOGO_ART);
  const logoVisibleWidth = Math.min(
    290,
    Math.max(240, width - DesignTokens.spacing.screenX * 2),
  );
  const logoVisibleHeight = Math.round(logoVisibleWidth * (logoArtH / logoArtW));
  const logoImgWidth = Math.round(logoVisibleWidth / logoArtW);
  const logoImgHeight = Math.round(logoImgWidth * (1024 / 1536));
  const logoImgLeft = -Math.round(HORIZONTAL_LOGO_ART.left * logoImgWidth);
  const logoImgTop = -Math.round(HORIZONTAL_LOGO_ART.top * logoImgHeight);

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
            <View
              style={[
                styles.logoViewport,
                { width: logoVisibleWidth, height: logoVisibleHeight },
              ]}
              testID="home-horizontal-logo"
              accessibilityLabel="AnyChess"
            >
              <Image
                source={BrandAssets.horizontalLogo}
                style={{
                  position: 'absolute',
                  left: logoImgLeft,
                  top: logoImgTop,
                  width: logoImgWidth,
                  height: logoImgHeight,
                }}
                contentFit="fill"
                cachePolicy="memory-disk"
                recyclingKey="home-horizontal-logo"
                accessibilityIgnoresInvertColors
              />
            </View>
          </View>
        </View>
      </View>

      <View style={styles.cards}>
        {MAIN_MODE_CARD_META.map((mode) => {
          const titleKey = `modes.${mode.id}.title` as MessageKey;
          const descKey = `modes.${mode.id}.description` as MessageKey;
          return (
            <ModeCard
              key={mode.id}
              modeId={mode.id}
              title={t(titleKey)}
              description={t(descKey)}
              iconName={mode.iconName}
              illustration={modeCardIllustration(mode.id)}
              onPress={() => router.push(mode.route)}
              testID={`menu-${mode.id}`}
            />
          );
        })}
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
    paddingTop: 2,
  },
  logoViewport: {
    overflow: 'hidden',
    position: 'relative',
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
