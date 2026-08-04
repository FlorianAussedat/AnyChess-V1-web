import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { SoundToggle } from '@/components/SoundToggle';
import { AnyChessAppShell } from '@/components/AnyChessAppShell';
import { DesignTokens } from '@/constants/designTokens';

export function ModeScreenShell({
  title,
  children,
  onBack,
}: {
  title: string;
  children: React.ReactNode;
  onBack?: () => void;
}) {
  const colors = useColors();
  const router = useRouter();

  return (
    <AnyChessAppShell style={styles.root}>
      <View style={styles.header}>
        <Pressable
          onPress={onBack ?? (() => router.back())}
          hitSlop={10}
          style={({ pressed }) => [
            styles.iconBtn,
            { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Ionicons name="chevron-back" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
          {title}
        </Text>
        <SoundToggle />
      </View>
      {children}
    </AnyChessAppShell>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 14, gap: DesignTokens.spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: {
    width: DesignTokens.headerIconButton,
    height: DesignTokens.headerIconButton,
    borderRadius: DesignTokens.radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: DesignTokens.typography.modeTitle,
    fontFamily: DesignTokens.typography.weightBold,
    flex: 1,
  },
});
