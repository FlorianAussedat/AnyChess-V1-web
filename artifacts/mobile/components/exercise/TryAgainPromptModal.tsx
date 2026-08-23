/**
 * Modal — propose adding position to « Essaie encore ! » after scored attempt.
 */
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/ui/AppButton';
import { useColors } from '@/hooks/useColors';
import { DesignTokens } from '@/constants/designTokens';

type Props = {
  visible: boolean;
  alreadyInPool: boolean;
  onYes: () => void;
  onNo: () => void;
  testID?: string;
};

export function TryAgainPromptModal({
  visible,
  alreadyInPool,
  onYes,
  onNo,
  testID,
}: Props) {
  const colors = useColors();

  if (alreadyInPool) {
    return visible ? (
      <Text
        style={{ color: colors.mutedForeground, textAlign: 'center', fontSize: 13 }}
        testID="try-again-already"
      >
        Déjà dans « Essaie encore ! »
      </Text>
    ) : null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" testID={testID}>
      <Pressable style={styles.backdrop} onPress={onNo}>
        <Pressable style={[styles.card, { backgroundColor: colors.card }]} onPress={() => {}}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Ajouter cette position à « Essaie encore ! » ?
          </Text>
          <View style={styles.actions}>
            <AppButton label="Oui" onPress={onYes} testID="try-again-yes" />
            <AppButton label="Non" onPress={onNo} variant="secondary" testID="try-again-no" />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: DesignTokens.spacing.lg,
  },
  card: {
    borderRadius: DesignTokens.radius.lg,
    padding: DesignTokens.spacing.lg,
    gap: DesignTokens.spacing.md,
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    textAlign: 'center',
  },
  actions: { gap: DesignTokens.spacing.sm },
});
