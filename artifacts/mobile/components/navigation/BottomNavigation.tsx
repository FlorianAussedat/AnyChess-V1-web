/**
 * Persistent AnyChess bottom navigation — Accueil / Records / Profil.
 */
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { usePathname, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { BrandAssets } from '@/constants/BrandAssets';
import { DesignTokens } from '@/constants/designTokens';
import { NAV_HOME_ART, artHeight } from '@/constants/brandArtBounds';

export type BottomNavTabId = 'home' | 'records' | 'profil';

function resolveActiveTab(pathname: string): BottomNavTabId | null {
  if (pathname === '/' || pathname === '/index') return 'home';
  if (pathname.startsWith('/records')) return 'records';
  if (pathname.startsWith('/profil')) return 'profil';
  return null;
}

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
  const { bottom: safeBottom } = useAppSafeInsets();
  const router = useRouter();
  const pathname = usePathname();
  const active = resolveActiveTab(pathname);

  const goHome = () => {
    if (pathname === '/' || pathname === '/index') return;
    router.replace('/' as Href);
  };

  const goRecords = () => {
    if (pathname.startsWith('/records')) return;
    router.push('/records' as Href);
  };

  const goProfil = () => {
    if (pathname.startsWith('/profil')) return;
    router.push('/profil' as Href);
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: safeBottom }]}
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
          label="Accueil"
          active={active === 'home'}
          onPress={goHome}
          testID="nav-home"
          renderIcon={() => <HomeNavIcon active={active === 'home'} />}
          activeColor={colors.primary}
          inactiveColor={colors.mutedForeground}
        />
        <NavItem
          label="Records"
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
          label="Profil"
          active={active === 'profil'}
          onPress={goProfil}
          testID="nav-profil"
          renderIcon={(color) => (
            <Ionicons name="person-outline" size={DesignTokens.bottomNavIconSize} color={color} />
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
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
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
