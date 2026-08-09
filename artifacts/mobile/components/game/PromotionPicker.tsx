/**
 * Compact promotion piece picker for Classic keypad (and shared use).
 * Does not submit moves — parent appends the chosen piece and submits.
 */
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { usePreferences } from '@/hooks/usePreferences';
import { DesignTokens } from '@/constants/designTokens';
import type { PromotionPiece } from '@/lib/moveInput/keypadPromotion';

type Props = {
  visible: boolean;
  onChoose: (piece: PromotionPiece) => void;
  onCancel: () => void;
  testID?: string;
};

const PIECES: { id: PromotionPiece; fr: string; en: string }[] = [
  { id: 'q', fr: 'D', en: 'Q' },
  { id: 'r', fr: 'T', en: 'R' },
  { id: 'b', fr: 'F', en: 'B' },
  { id: 'n', fr: 'C', en: 'N' },
];

export function PromotionPicker({
  visible,
  onChoose,
  onCancel,
  testID = 'promotion-picker',
}: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const { chessNotation } = usePreferences();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onCancel}
        testID={`${testID}-backdrop`}
      >
        <Pressable
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={(e) => e.stopPropagation?.()}
          testID={testID}
        >
          <Text style={[styles.title, { color: colors.foreground }]}>
            {t('game.promotion')}
          </Text>
          <View style={styles.row}>
            {PIECES.map((p) => {
              const label = chessNotation === 'en' ? p.en : p.fr;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => onChoose(p.id)}
                  testID={`${testID}-${p.id}`}
                  accessibilityLabel={label}
                  style={({ pressed }) => [
                    styles.pieceBtn,
                    {
                      backgroundColor: colors.primary,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text style={styles.pieceLabel}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable onPress={onCancel} testID={`${testID}-cancel`} hitSlop={8}>
            <Text style={[styles.cancel, { color: colors.mutedForeground }]}>
              {t('common.cancel')}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: DesignTokens.radius.md,
    borderWidth: 1,
    padding: DesignTokens.spacing.lg,
    gap: DesignTokens.spacing.md,
  },
  title: {
    fontSize: 15,
    fontFamily: DesignTokens.typography.weightSemiBold,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  pieceBtn: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pieceLabel: {
    color: '#fff',
    fontSize: 20,
    fontFamily: DesignTokens.typography.weightBold,
  },
  cancel: {
    textAlign: 'center',
    fontSize: 13,
    fontFamily: DesignTokens.typography.weightSemiBold,
    marginTop: 4,
  },
});
