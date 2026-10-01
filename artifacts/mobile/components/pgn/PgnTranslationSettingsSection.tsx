import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useCloudAccount } from '@/hooks/useCloudAccount';
import { usePreferences } from '@/hooks/usePreferences';
import { usePgnCommentTranslations } from '@/hooks/usePgnCommentTranslations';
import { useTranslation } from '@/hooks/useTranslation';
import { setAuthReturn } from '@/lib/cloud/authReturn';
import { BooleanSettingRow } from '@/components/ui/BooleanSettingRow';
import { DesignTokens } from '@/constants/designTokens';
import {
  applyPgnTranslationPreferences,
  formatPgnTranslateProbe,
  getPgnTranslateProbeSnapshot,
  retryPgnTranslation,
} from '@/lib/pgnComments';
import { defaultPgnTranslationProvider } from '@/lib/pgnComments/provider.ts';
import { copyToClipboard } from '@/lib/clipboard';

export function PgnTranslationSettingsSection() {
  const colors = useColors();
  const router = useRouter();
  const cloud = useCloudAccount();
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
  const probe = getPgnTranslateProbeSnapshot(queue);
  const nextAvailable = probe.lastCall?.nextAvailable;
  const usageCount = probe.lastCall?.usageCharacterCount;
  const usageLimit = probe.lastCall?.usageCharacterLimit;

  const requireAccount = (): boolean => {
    if (!cloud.sessionReady || cloud.user) return Boolean(cloud.user);
    setAuthReturn('/parametres');
    router.push('/utilisateur' as Href);
    return false;
  };

  const toggleExisting = async () => {
    if (busy) return;
    if (!requireAccount()) return;
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
    if (!requireAccount()) return;
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
    if (!requireAccount()) return;
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
      ? nextAvailable
        ? `${t('pgn.translationQuota')} ${t('pgn.translationQuotaResume', { delay: nextAvailable })}`
        : t('pgn.translationQuota')
      : lastError === 'rate_limited'
        ? t('settings.translationRateLimited')
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
      lastError === 'rate_limited' ||
      lastError === 'offline' ||
      lastError === 'timeout' ||
      lastError === 'failed' ||
      progress.failed > 0);

  return (
    <View style={styles.wrap} testID="parametres-translation-section">
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
        {t('settings.translation')}
      </Text>
      {cloud.sessionReady && !cloud.user ? (
        <Text
          style={[styles.hint, { color: colors.mutedForeground }]}
          testID="parametres-translation-needs-account"
        >
          {t('guest.translationNeedsAccount')}
        </Text>
      ) : null}
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
      {usageCount != null && usageLimit != null ? (
        <Text
          style={[styles.hint, { color: colors.mutedForeground }]}
          testID="parametres-translation-usage"
        >
          {t('pgn.translationUsage', { used: usageCount, limit: usageLimit })}
        </Text>
      ) : null}
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

/**
 * Dev-only technical dump. Hidden until the discreet link at the bottom of
 * Settings is pressed. User-facing progress and errors stay in the section above.
 */
export function PgnTranslationTechnicalDiagnostic() {
  const colors = useColors();
  const { t } = useTranslation();
  const { queue } = usePgnCommentTranslations();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;
  const diagnostic = open ? formatPgnTranslateProbe(getPgnTranslateProbeSnapshot(queue)) : '';

  return (
    <View style={styles.devDiag} testID="parametres-technical-diagnostic">
      <Pressable
        onPress={() => setOpen((value) => !value)}
        testID="parametres-technical-diagnostic-link"
        accessibilityRole="button"
      >
        <Text style={[styles.devLink, { color: colors.mutedForeground }]}>
          {t('settings.technicalDiagnostic')}
        </Text>
      </Pressable>
      {open ? (
        <View style={styles.devDetails}>
          <Text
            selectable
            style={[styles.diag, { color: colors.foreground, backgroundColor: colors.card }]}
            testID="parametres-translation-diag"
          >
            {diagnostic}
          </Text>
          <Pressable
            onPress={() => {
              void copyToClipboard(diagnostic).then((ok) => {
                if (ok) {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }
              });
            }}
            testID="parametres-translation-diag-copy"
            style={({ pressed }) => [
              styles.retry,
              { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={{ color: colors.primary, fontFamily: DesignTokens.typography.weightSemiBold }}>
              {copied ? t('settings.translationDiagCopied') : t('settings.translationDiagCopy')}
            </Text>
          </Pressable>
        </View>
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
  diag: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'Inter_400Regular',
    borderRadius: DesignTokens.radius.sm,
    padding: 10,
  },
  devDiag: {
    marginTop: DesignTokens.spacing.lg,
    alignItems: 'flex-start',
    gap: 8,
  },
  devLink: {
    fontSize: 12,
    lineHeight: 16,
    textDecorationLine: 'underline',
    fontFamily: DesignTokens.typography.weightRegular,
  },
  devDetails: { alignSelf: 'stretch', gap: 8 },
});
