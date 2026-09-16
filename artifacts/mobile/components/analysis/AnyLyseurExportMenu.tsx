/**
 * Export menu for AnyLyseur — never copies immediately on Export press.
 */
import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { DesignTokens } from '@/constants/designTokens';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';

export type AnyLyseurExportMenuProps = {
  visible: boolean;
  onClose: () => void;
  includeEvals: boolean;
  onIncludeEvalsChange: (value: boolean) => void;
  onCopyPgn: () => void;
  onDownloadPgn: () => void;
  onCopyFen: () => void;
  onDownloadFen: () => void;
};

export function AnyLyseurExportMenu({
  visible,
  onClose,
  includeEvals,
  onIncludeEvalsChange,
  onCopyPgn,
  onDownloadPgn,
  onCopyFen,
  onDownloadFen,
}: AnyLyseurExportMenuProps) {
  const colors = useColors();
  const { t } = useTranslation();

  const row = (label: string, onPress: () => void, testID: string) => (
    <Pressable
      key={testID}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? colors.muted : colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.rowLabel, { color: colors.foreground }]}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        testID="anyliseur-export-backdrop"
      >
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.background }]}
          onPress={(e) => e.stopPropagation?.()}
        >
          <Text style={[styles.title, { color: colors.foreground }]}>
            {t('parties.anyliseurExport')}
          </Text>

          <View style={styles.switchRow}>
            <Text style={{ color: colors.foreground, flex: 1 }}>
              {t('parties.anyliseurExportIncludeEvals')}
            </Text>
            <Switch
              testID="anyliseur-export-include-evals"
              value={includeEvals}
              onValueChange={onIncludeEvalsChange}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>

          {row(t('parties.anyliseurExportCopyPgn'), onCopyPgn, 'anyliseur-export-copy-pgn')}
          {row(
            t('parties.anyliseurExportDownloadPgn'),
            onDownloadPgn,
            'anyliseur-export-download-pgn',
          )}
          {row(t('parties.anyliseurExportCopyFen'), onCopyFen, 'anyliseur-export-copy-fen')}
          {row(
            t('parties.anyliseurExportDownloadFen'),
            onDownloadFen,
            'anyliseur-export-download-fen',
          )}

          <Pressable
            testID="anyliseur-export-close"
            onPress={onClose}
            style={[styles.close, { borderColor: colors.border }]}
          >
            <Text style={{ color: colors.mutedForeground }}>
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
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: DesignTokens.radius.lg,
    borderTopRightRadius: DesignTokens.radius.lg,
    padding: DesignTokens.spacing.lg,
    gap: DesignTokens.spacing.sm,
  },
  title: {
    fontFamily: DesignTokens.typography.weightBold,
    fontSize: 18,
    marginBottom: 4,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  row: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.md,
    paddingVertical: 14,
    paddingHorizontal: 14,
    minHeight: 48,
    justifyContent: 'center',
  },
  rowLabel: {
    fontFamily: DesignTokens.typography.weightSemiBold,
    fontSize: 15,
  },
  close: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
});
