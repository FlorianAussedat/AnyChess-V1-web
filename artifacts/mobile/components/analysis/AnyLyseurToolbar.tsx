/**
 * Compact icon toolbar for AnyLyseur (flip, arrows, profile, import/export, Lecteur, return).
 * Profile opens a small modal — not permanent chips.
 */
import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DesignTokens } from '@/constants/designTokens';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import type { AnalysisProfileId } from '@/lib/analysis';

export type AnyLyseurToolbarProps = {
  onFlip: () => void;
  arrowsEnabled: boolean;
  onToggleArrows: () => void;
  profileId: AnalysisProfileId;
  onProfileChange: (id: AnalysisProfileId) => void;
  onImport: () => void;
  onExport: () => void;
  onOpenReader: () => void;
  canReturnToOrigin: boolean;
  onReturnToOrigin: () => void;
  testID?: string;
};

function ToolBtn({
  icon,
  label,
  hint,
  onPress,
  active,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  onPress: () => void;
  active?: boolean;
  testID: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      testID={testID}
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(active) }}
      onPress={onPress}
      // @ts-expect-error web tooltip
      title={Platform.OS === 'web' ? label : undefined}
      hitSlop={4}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: active ? colors.primary : colors.card,
          borderColor: active ? colors.primary : colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Ionicons
        name={icon}
        size={20}
        color={active ? colors.primaryForeground : colors.foreground}
      />
    </Pressable>
  );
}

const PROFILES: AnalysisProfileId[] = ['fast', 'normal', 'deep'];

export function AnyLyseurToolbar({
  onFlip,
  arrowsEnabled,
  onToggleArrows,
  profileId,
  onProfileChange,
  onImport,
  onExport,
  onOpenReader,
  canReturnToOrigin,
  onReturnToOrigin,
  testID = 'anyliseur-toolbar',
}: AnyLyseurToolbarProps) {
  const colors = useColors();
  const { t } = useTranslation();
  const [profileOpen, setProfileOpen] = useState(false);

  const profileLabel = (id: AnalysisProfileId) => {
    if (id === 'fast') return t('parties.anyliseurProfileFast');
    if (id === 'deep') return t('parties.anyliseurProfileDeep');
    return t('parties.anyliseurProfileNormal');
  };

  return (
    <View style={styles.wrap} testID={testID}>
      <ToolBtn
        icon="swap-vertical"
        label={t('parties.anyliseurA11yFlip')}
        hint={t('parties.anyliseurA11yFlipHint')}
        onPress={onFlip}
        testID="anyliseur-flip"
      />
      <ToolBtn
        icon="arrow-forward"
        label={
          arrowsEnabled
            ? t('parties.anyliseurArrowsOn')
            : t('parties.anyliseurArrowsOff')
        }
        hint={t('parties.anyliseurA11yArrowsHint')}
        onPress={onToggleArrows}
        active={arrowsEnabled}
        testID="anyliseur-arrows-toggle"
      />
      <ToolBtn
        icon="options"
        label={t('parties.anyliseurA11yProfile')}
        hint={t('parties.anyliseurA11yProfileHint')}
        onPress={() => setProfileOpen(true)}
        active={profileOpen}
        testID="anyliseur-profile"
      />
      <ToolBtn
        icon="document-attach-outline"
        label={t('parties.anyliseurA11yImport')}
        hint={t('parties.anyliseurA11yImportHint')}
        onPress={onImport}
        testID="anyliseur-import"
      />
      <ToolBtn
        icon="share-outline"
        label={t('parties.anyliseurExport')}
        hint={t('parties.anyliseurA11yExportHint')}
        onPress={onExport}
        testID="anyliseur-export"
      />
      <ToolBtn
        icon="book-outline"
        label={t('parties.anyliseurOpenReader')}
        hint={t('parties.anyliseurA11yOpenReaderHint')}
        onPress={onOpenReader}
        testID="anyliseur-open-reader"
      />
      {canReturnToOrigin ? (
        <ToolBtn
          icon="return-down-back"
          label={t('parties.anyliseurA11yReturn')}
          hint={t('parties.anyliseurA11yReturnHint')}
          onPress={onReturnToOrigin}
          testID="anyliseur-return-origin"
        />
      ) : null}

      <Modal
        visible={profileOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setProfileOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setProfileOpen(false)}
            accessibilityRole="button"
            accessibilityLabel={t('parties.anyliseurProfileClose')}
            testID="anyliseur-profile-backdrop"
          />
          <View
            style={[
              styles.modalPanel,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            testID="anyliseur-profile-panel"
          >
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {t('parties.anyliseurProfileTitle')}
            </Text>
            <Text
              style={[styles.modalHint, { color: colors.mutedForeground }]}
            >
              {t('parties.anyliseurProfileHint')}
            </Text>
            {PROFILES.map((id) => {
              const active = profileId === id;
              return (
                <Pressable
                  key={id}
                  testID={`anyliseur-profile-${id}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    onProfileChange(id);
                    setProfileOpen(false);
                  }}
                  style={[
                    styles.profileRow,
                    {
                      backgroundColor: active
                        ? colors.primary
                        : colors.secondary,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active
                        ? colors.primaryForeground
                        : colors.foreground,
                      fontFamily: DesignTokens.typography.weightSemiBold,
                      fontSize: 14,
                    }}
                  >
                    {profileLabel(id)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
  },
  btn: {
    width: 44,
    height: 44,
    minWidth: 44,
    minHeight: 44,
    borderRadius: DesignTokens.radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalPanel: {
    width: '100%',
    maxWidth: 320,
    borderRadius: DesignTokens.radius.lg,
    borderWidth: 1,
    padding: DesignTokens.spacing.lg,
    gap: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  modalHint: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 4,
  },
  profileRow: {
    minHeight: 44,
    borderRadius: DesignTokens.radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
});
