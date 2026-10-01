import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { usePreferences } from '@/hooks/usePreferences';
import { usePgnCommentTranslations } from '@/hooks/usePgnCommentTranslations';
import { useTranslation } from '@/hooks/useTranslation';
import { BooleanSettingRow } from '@/components/ui/BooleanSettingRow';
import { DesignTokens } from '@/constants/designTokens';
import {
  applyPgnTranslationPreferences,
  retryPgnTranslation,
} from '@/lib/pgnComments';
import { defaultPgnTranslationProvider } from '@/lib/pgnComments/provider.ts';

export function PgnTranslationSettingsSection() {
  const colors = useColors();
  const { t } = useTranslation();
  const {
    translateExistingPgnComments,
    translateImportedPgnComments,
    updatePreferences,
  } = usePreferences();
  const { queue } = usePgnCommentTranslations();
  const progress = queue.getProgress();
  const lastError = queue.getLastError();
  const configured = defaultPgnTranslationProvider.configured;
  const [busy, setBusy] = useState<'existing' | 'import' | 'retry' | null>(null);

  const toggleExisting = async () => {
    if (busy) return;
    setBusy('existing');
    try {
      await updatePreferences({
        translateExistingPgnComments: !translateExistingPgnComments,
      });
      await applyPgnTranslationPreferences();
    } finally {
      setBusy(null);
    }
  };

  const toggleImport = async () => {
    if (busy) return;
    setBusy('import');
    try {
      await updatePreferences({
        translateImportedPgnComments: !translateImportedPgnComments,
      });
      await applyPgnTranslationPreferences();
    } finally {
      setBusy(null);
    }
  };

  const retry = async () => {
    if (busy) return;
    setBusy('retry');
    try {
      await retryPgnTranslation();
    } finally {
      setBusy(null);
    }
  };

  const statusText = !configured
    ? t('pgn.serviceNotConfigured')
    : lastError === 'quota'
      ? t('pgn.translationQuota')
      : lastError === 'timeout'
        ? t('settings.translationTimeout')
        : lastError === 'offline'
          ? t('pgn.offlineQueued')
          : lastError === 'not_configured'
            ? t('pgn.serviceNotConfigured')
            : lastError === 'failed'
              ? t('pgn.translationFailed')
              : progress.phase === 'empty'
                ? t('settings.translationNone')
                : progress.phase === 'complete'
                  ? t('settings.translationComplete')
                  : progress.phase === 'paused'
                    ? t('settings.translationPaused')
                    : t('settings.translationProgress', {
                        done: progress.translated,
                        total: progress.total,
                      });

  const retryable =
    configured &&
    (lastError === 'quota' ||
      lastError === 'offline' ||
      lastError === 'timeout' ||
      lastError === 'failed' ||
      progress.failed > 0);

  return (
    <View style={styles.wrap} testID="parametres-translation-section">
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
        {t('settings.translation')}
      </Text>
      <View style={styles.section}>
        <BooleanSettingRow
          label={t('settings.translateExistingPgn')}
          value={translateExistingPgnComments}
          onToggle={() => {
            void toggleExisting();
          }}
          disabled={!configured}
          disabledReason={t('pgn.serviceNotConfigured')}
          testID="parametres-translate-existing"
        />
        <BooleanSettingRow
          label={t('settings.translateImportedPgn')}
          value={translateImportedPgnComments}
          onToggle={() => {
            void toggleImport();
          }}
          disabled={!configured}
          disabledReason={t('pgn.serviceNotConfigured')}
          testID="parametres-translate-import"
        />
      </View>
      <Text
        style={[styles.status, { color: lastError ? colors.destructive : colors.mutedForeground }]}
        testID="parametres-translation-status"
      >
        {statusText}
      </Text>
      {progress.total > 0 ? (
        <Text
          style={[styles.hint, { color: colors.mutedForeground }]}
          testID="parametres-translation-counts"
        >
          {t('settings.translationCounts', {
            done: progress.translated,
            pending: progress.pending,
            failed: progress.failed,
          })}
        </Text>
      ) : null}
      {progress.total > 0 ? (
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          {t('settings.translationProgressHint', {
            done: progress.translated,
            total: progress.total,
          })}
        </Text>
      ) : null}
      {retryable ? (
        <Pressable
          onPress={() => {
            void retry();
          }}
          disabled={busy === 'retry'}
          testID="parametres-translation-retry"
          style={({ pressed }) => [
            styles.retry,
            {
              borderColor: colors.border,
              opacity: busy === 'retry' ? 0.45 : pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text style={{ color: colors.primary, fontFamily: DesignTokens.typography.weightSemiBold }}>
            {t('settings.translationRetry')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: DesignTokens.spacing.sm },
  sectionLabel: {
    marginTop: DesignTokens.spacing.sm,
    fontSize: 11,
    letterSpacing: 0.6,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  section: { gap: 8 },
  status: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: DesignTokens.typography.weightRegular,
  },
  retry: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: DesignTokens.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: DesignTokens.minTouchTarget,
    justifyContent: 'center',
  },
});
