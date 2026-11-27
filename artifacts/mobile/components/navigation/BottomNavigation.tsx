/**
 * Persistent AnyChess bottom navigation — Accueil / Records / Utilisateur / Paramètres.
 */
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useTranslation } from '@/hooks/useTranslation';
import { BrandAssets } from '@/constants/BrandAssets';
import { DesignTokens } from '@/constants/designTokens';
import { NAV_HOME_ART, artHeight } from '@/constants/brandArtBounds';

export type { BottomNavTabId } from '@/lib/navigation/routes';
import { resolveActiveTab, navigateMainTab } from '@/lib/navigation/routes';

function HomeNavIcon({ active }: { active: boolean }) {
  // ~28–32px visible artwork; compensate for canvas padding (~44% × 28% content).
  const visible = 30;
  const aH = artHeight(NAV_HOME_ART);
  const viewport = DesignTokens.bottomNavHomeIconWidth;
  const imgHeight = Math.round(visible / aH);
  const imgWidth = Math.round(imgHeight * (1024 / 1536));
  const left = Math.round((viewport - visible) / 2 - NAV_HOME_ART.left * imgWidth);
  const top = Math.round((viewport - visible) / 2 - NAV_HOME_ART.top * imgHeight);

  return (
    <View
      style={[
        styles.homeViewport,
        {
          width: viewport,
          height: DesignTokens.bottomNavHomeIconHeight,
          opacity: active ? 1 : 0.72,
        },
      ]}
    >
      <Image
        source={BrandAssets.navHome}
        style={{
          position: 'absolute',
          left,
          top,
          width: imgWidth,
          height: imgHeight,
        }}
        contentFit="fill"
        cachePolicy="memory-disk"
        recyclingKey="nav-home"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

export function BottomNavigation() {
  const colors = useColors();
  const { bottom: safeBottom, left: safeLeft, right: safeRight } = useAppSafeInsets();
  const pathname = usePathname();
  const router = useRouter();
  const active = resolveActiveTab(pathname);
  const { t } = useTranslation();

  if (!active) return null;

  const goHome = () => navigateMainTab(router, pathname, '/');
  const goRecords = () => navigateMainTab(router, pathname, '/records');
  const goUtilisateur = () => navigateMainTab(router, pathname, '/utilisateur');
  const goParametres = () => navigateMainTab(router, pathname, '/parametres');

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: safeBottom, paddingLeft: safeLeft, paddingRight: safeRight, backgroundColor: colors.background }]}
    >
      <View
        style={[
          styles.bar,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            height: DesignTokens.bottomNavContentHeight,
          },
        ]}
        testID="bottom-navigation"
        accessibilityRole="tablist"
      >
        <NavItem
          label={t('nav.home')}
          active={active === 'home'}
          onPress={goHome}
          testID="nav-home"
          renderIcon={() => <HomeNavIcon active={active === 'home'} />}
          activeColor={colors.primary}
          inactiveColor={colors.mutedForeground}
        />
        <NavItem
          label={t('nav.records')}
          active={active === 'records'}
          onPress={goRecords}
          testID="nav-records"
          renderIcon={(color) => (
            <Ionicons name="trophy-outline" size={DesignTokens.bottomNavIconSize} color={color} />
          )}
          activeColor={colors.primary}
          inactiveColor={colors.mutedForeground}
        />
        <NavItem
          label={t('nav.utilisateur')}
          active={active === 'utilisateur'}
          onPress={goUtilisateur}
          testID="nav-utilisateur"
          renderIcon={(color) => (
            <Ionicons name="person-outline" size={DesignTokens.bottomNavIconSize} color={color} />
          )}
          activeColor={colors.primary}
          inactiveColor={colors.mutedForeground}
        />
        <NavItem
          label={t('nav.parametres')}
          active={active === 'parametres'}
          onPress={goParametres}
          testID="nav-parametres"
          renderIcon={(color) => (
            <Ionicons name="settings-outline" size={DesignTokens.bottomNavIconSize} color={color} />
          )}
          activeColor={colors.primary}
          inactiveColor={colors.mutedForeground}
        />
      </View>
    </View>
  );
}

function NavItem({
  label,
  active,
  onPress,
  testID,
  renderIcon,
  activeColor,
  inactiveColor,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID: string;
  renderIcon: (color: string) => React.ReactNode;
  activeColor: string;
  inactiveColor: string;
}) {
  const color = active ? activeColor : inactiveColor;
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.item, { opacity: pressed ? 0.7 : 1 }]}
    >
      {renderIcon(color)}
      <Text style={[styles.label, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexShrink: 0,
  },
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minHeight: DesignTokens.minTouchTarget,
  },
  label: {
    fontSize: DesignTokens.typography.micro,
    fontFamily: 'Inter_500Medium',
    letterSpacing: 0.2,
  },
  homeViewport: {
    overflow: 'hidden',
    position: 'relative',
  },
});
