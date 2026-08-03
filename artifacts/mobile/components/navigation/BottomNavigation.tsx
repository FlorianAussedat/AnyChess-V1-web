/**
 * Persistent AnyChess bottom navigation — Accueil / Records / Profil.
 */
import React from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { usePathname, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { BrandAssets } from '@/constants/BrandAssets';
import { DesignTokens } from '@/constants/designTokens';

export type BottomNavTabId = 'home' | 'records' | 'profil';

function resolveActiveTab(pathname: string): BottomNavTabId | null {
  if (pathname === '/' || pathname === '/index') return 'home';
  if (pathname.startsWith('/records')) return 'records';
  if (pathname.startsWith('/profil')) return 'profil';
  return null;
}

export function BottomNavigation() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const active = resolveActiveTab(pathname);
  const isWeb = Platform.OS === 'web';
  const safeBottom = isWeb ? 34 : insets.bottom;

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
          renderIcon={() => (
            <Image
              source={BrandAssets.navHome}
              style={[
                styles.homeIcon,
                { opacity: active === 'home' ? 1 : 0.72 },
              ]}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          )}
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
  homeIcon: {
    width: DesignTokens.bottomNavHomeIconWidth,
    height: DesignTokens.bottomNavHomeIconHeight,
  },
});
