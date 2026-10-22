import React, { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';

type Props = {
  visible: boolean;
  body: string;
  exportedText: string;
  exportPgn: () => string;
  downloadPgn: () => Promise<unknown>;
  onClose: () => void;
  /** Save into Game Library and open the unified analyzer. */
  onOpenInAnalyzer?: () => void | Promise<void>;
};

export function GameExportPgnModal({
  visible,
  body,
  exportedText,
  exportPgn,
  downloadPgn,
  onClose,
  onOpenInAnalyzer,
}: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const exportLock = useRef(false);
  const [opening, setOpening] = useState(false);

  const exportOnly = async () => {
    if (exportLock.current) return;
    exportLock.current = true;
    setOpening(true);
    try {
      await downloadPgn();
    } finally {
      exportLock.current = false;
      setOpening(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View
          style={[
            styles.modalCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>
            {onOpenInAnalyzer ? t('game.exportOrAnalyze') : t('game.exportPgn')}
          </Text>
          <Text style={[styles.modalBody, { color: colors.mutedForeground }]}>
            {body}
          </Text>
          <View style={styles.modalActions}>
            <Pressable
              onPress={onClose}
              disabled={opening}
              style={({ pressed }) => [
                styles.modalBtn,
                {
                  borderColor: colors.border,
                  opacity: pressed || opening ? 0.6 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color: colors.foreground,
                  fontFamily: 'Inter_500Medium',
                }}
              >
                {t('game.exportNo')}
              </Text>
            </Pressable>
            {onOpenInAnalyzer ? (
              <>
                <Pressable
                  testID="game-export-file-actions"
                  accessibilityRole="button"
                  onPress={() => void exportOnly()}
                  disabled={opening}
                  style={({ pressed }) => [
                    styles.modalBtn,
                    {
                      borderColor: colors.border,
                      opacity: pressed || opening ? 0.6 : 1,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: colors.foreground,
                      fontFamily: 'Inter_500Medium',
                    }}
                  >
                    {t('game.export')}
                  </Text>
                </Pressable>
                <Pressable
                  testID="game-export-open-analyzer"
                  disabled={opening}
                  onPress={() => {
                    setOpening(true);
                    void Promise.resolve(onOpenInAnalyzer())
                      .catch(() => {})
                      .finally(() => {
                        setOpening(false);
                        onClose();
                      });
                  }}
                  style={({ pressed }) => [
                    styles.modalBtn,
                    {
                      backgroundColor: colors.primary,
                      borderColor: colors.primary,
                      opacity: pressed || opening ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: colors.primaryForeground,
                      fontFamily: 'Inter_600SemiBold',
                    }}
                  >
                    {opening
                      ? t('openings.opening')
                      : t('quiz.theoreticalAnalyse')}
                  </Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                testID="game-export-file-actions"
                accessibilityRole="button"
                onPress={() => void exportOnly()}
                disabled={opening}
                style={({ pressed }) => [
                  styles.modalBtn,
                  {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  style={{
                    color: colors.primaryForeground,
                    fontFamily: 'Inter_600SemiBold',
                  }}
                >
                  {t('game.exportYes')}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  modalTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  modalBody: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19 },
  modalActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'flex-end',
  },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
});
