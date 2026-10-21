import React from 'react';
import { StyleSheet } from 'react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
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

  return (
    <AnyChessAppShell style={styles.root}>
      <ScreenHeader
        onBack={onBack}
        title={title}
        showSound
      />
      {children}
    </AnyChessAppShell>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 14, gap: DesignTokens.spacing.md },
});
