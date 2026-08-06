import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { SoundToggle } from '@/components/SoundToggle';
import { BackButton } from '@/components/BackButton';
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
        <BackButton onPress={onBack ?? (() => router.back())} />
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
  title: {
    fontSize: DesignTokens.typography.modeTitle,
    fontFamily: DesignTokens.typography.weightBold,
    flex: 1,
  },
});
