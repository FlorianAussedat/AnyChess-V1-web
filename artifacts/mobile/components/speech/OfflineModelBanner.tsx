/**
 * Download prompt for one offline dictation model.
 * It sits above the navigation and does not replace the keyboard.
 * Closing the mobile-data dialog, or the Android back key, does not start the transfer.
 */
import React, { useEffect, useSyncExternalStore } from 'react';
import { BackHandler, Modal, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '@/hooks/useTranslation';
import { useColors } from '@/hooks/useColors';
import { DesignTokens } from '@/constants/designTokens';
import { AppButton } from '@/components/ui/AppButton';
import {
  cancelOfflineModel,
  dismissOfflineModel,
  getOfflineModelView,
  noteOfflineNetwork,
  requestOfflineDownload,
  requestOfflineMobileDownload,
  retryOfflineModel,
  subscribeOfflineModel,
  waitOfflineForWifi,
} from '@/lib/speech/offlineModelSession';
import { VOSK_MODELS } from '@/lib/speech/voskModels';
import { formatMegabytesOnly, networkKindFromState, type NetworkKind } from '@/lib/speech/offlineModelFlow';
import * as Network from 'expo-network';

async function currentNetwork(): Promise<NetworkKind> {
  try {
    return networkKindFromState(await Network.getNetworkStateAsync());
  } catch {
    return 'unknown';
  }
}

function progressPercent(received: number, total: number): number {
  if (!Number.isFinite(received) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((received / total) * 100)));
}

export function OfflineModelBanner() {
  const view = useSyncExternalStore(subscribeOfflineModel, getOfflineModelView, getOfflineModelView);
  const { t, language } = useTranslation();
  const colors = useColors();

  useEffect(() => {
    if (!view) return;
    if (view.phase !== 'downloading' && view.phase !== 'waiting-wifi') return;
    let stop = false;
    const tick = () => {
      void currentNetwork().then((network) => {
        if (!stop) noteOfflineNetwork(network);
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [view?.phase]);

  useEffect(() => {
    if (!view) return;
    if (view.phase === 'ready') {
      const id = setTimeout(() => dismissOfflineModel(), 1600);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [view?.phase]);

  useEffect(() => {
    if (!view) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (
        view.phase === 'installing' ||
        view.phase === 'verifying' ||
        view.phase === 'preparing' ||
        view.phase === 'ready'
      ) {
        return true;
      }
      if (view.phase === 'downloading') {
        cancelOfflineModel();
        return true;
      }
      dismissOfflineModel();
      return true;
    });
    return () => sub.remove();
  }, [view]);

  if (!view) return null;
  const spec = VOSK_MODELS[view.language];
  const uiLang = language === 'en' ? 'en' : 'fr';
  const size = formatMegabytesOnly(spec.downloadBytes, uiLang);
  const installed = formatMegabytesOnly(spec.installedBytes, uiLang);
  const langName = view.language === 'en'
    ? (language === 'en' ? 'English' : 'Anglais')
    : (language === 'en' ? 'French' : 'français');

  let body = view.repairOnly
    ? t('speech.offlineRepairBody', { lang: langName })
    : t('speech.offlineDownloadBody', { lang: langName, size, installed });
  if (view.phase === 'waiting-wifi') {
    body = t('speech.offlineWaiting', { lang: langName, size });
  } else if (view.phase === 'downloading') {
    const percent = progressPercent(view.received, view.total);
    body = t('speech.offlineProgress', {
      progress: `${formatMegabytesOnly(view.received, uiLang)} / ${formatMegabytesOnly(view.total, uiLang)}`,
      percent: String(percent),
    });
  } else if (view.phase === 'verifying') {
    body = t('speech.offlineVerifying');
  } else if (view.phase === 'installing') {
    body = t('speech.offlineInstalling');
  } else if (view.phase === 'preparing') {
    body = t('speech.offlinePreparing');
  } else if (view.phase === 'ready') {
    body = t('speech.offlineReady', { lang: langName });
  } else if (view.phase === 'error') {
    if (view.reason === 'space') body = t('speech.offlineFailedSpace');
    else if (view.reason === 'integrity' || view.reason === 'incompatible') {
      body = t('speech.offlineFailedIntegrity');
    } else if (view.reason === 'load') body = t('speech.offlineFailedLoad');
    else if (view.reason === 'offline') body = t('speech.offlineFailedOffline');
    else if (view.reason === 'cancelled') body = t('speech.offlineCancel');
    else body = t('speech.offlineFailedNetwork');
  }

  const cellular = view.phase === 'cellular-ask';
  const percent = progressPercent(view.received, view.total);
  const busy =
    view.phase === 'downloading' ||
    view.phase === 'verifying' ||
    view.phase === 'installing' ||
    view.phase === 'preparing';
  const showProgress = view.phase === 'downloading' || view.phase === 'verifying' || view.phase === 'installing' || view.phase === 'preparing';

  return (
    <View>
      <Modal
        visible={cellular}
        transparent
        animationType="fade"
        onRequestClose={() => dismissOfflineModel()}
      >
        <View style={styles.backdrop}>
          <View style={[styles.dialog, { backgroundColor: colors.card, borderColor: colors.border }]} testID="offline-model-cellular">
            <Text style={[styles.title, { color: colors.foreground }]}>
              {t('speech.offlineCellularTitle')}
            </Text>
            <Text style={[styles.body, { color: colors.mutedForeground }]}>
              {t('speech.offlineCellularBody', { lang: langName, size })}
            </Text>
            <View style={styles.row}>
              <AppButton
                label={t('speech.offlineWaitWifi')}
                variant="secondary"
                testID="offline-model-wait-wifi"
                onPress={() => waitOfflineForWifi()}
                style={styles.flexBtn}
              />
              <AppButton
                label={t('speech.offlineDownload')}
                variant="primary"
                testID="offline-model-download-mobile"
                onPress={() => {
                  void currentNetwork().then((network) => requestOfflineMobileDownload(network));
                }}
                style={styles.flexBtn}
              />
            </View>
          </View>
        </View>
      </Modal>
      {cellular ? null : (
        <View
          style={[styles.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}
          testID="offline-model-banner"
        >
          <Text style={[styles.title, { color: colors.foreground }]}>
            {t('speech.offlineDownloadTitle')}
          </Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>{body}</Text>
          {showProgress ? (
            <View style={styles.progressBlock} testID="offline-model-progress">
              <View style={[styles.progressTrack, { backgroundColor: colors.secondary }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: colors.primary,
                      width: `${view.phase === 'downloading' ? percent : 100}%`,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.percent, { color: colors.primary }]}>
                {view.phase === 'downloading' ? `${percent} %` : t('speech.offlineProgressIndeterminate')}
              </Text>
            </View>
          ) : null}
          <View style={styles.row}>
            {view.phase === 'ask' ? (
              <AppButton
                label={view.repairOnly ? t('speech.offlineRepair') : t('speech.offlineDownload')}
                variant="primary"
                testID="offline-model-download"
                onPress={() => {
                  void currentNetwork().then((network) => requestOfflineDownload(network));
                }}
                style={styles.flexBtn}
              />
            ) : null}
            {view.phase === 'error' ? (
              <AppButton
                label={t('speech.offlineRetry')}
                variant="primary"
                testID="offline-model-retry"
                onPress={() => {
                  void currentNetwork().then((network) => retryOfflineModel(network));
                }}
                style={styles.flexBtn}
              />
            ) : null}
            {view.phase === 'ready' ? null : (
              <AppButton
                label={t('speech.offlineCancel')}
                variant="secondary"
                testID="offline-model-cancel"
                disabled={busy && view.phase !== 'downloading'}
                onPress={() => {
                  if (view.phase === 'downloading') cancelOfflineModel();
                  else if (!busy) dismissOfflineModel();
                }}
                style={styles.flexBtn}
              />
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: DesignTokens.spacing.md,
    marginBottom: DesignTokens.spacing.sm,
    padding: DesignTokens.spacing.md,
    borderRadius: DesignTokens.radius.md,
    borderWidth: 1,
    gap: 10,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 18, 0.72)',
    justifyContent: 'center',
    padding: 24,
  },
  dialog: {
    borderRadius: DesignTokens.radius.md,
    borderWidth: 1,
    padding: DesignTokens.spacing.md,
    gap: 12,
  },
  title: {
    fontFamily: DesignTokens.typography.weightBold,
    fontSize: 16,
  },
  body: {
    fontFamily: DesignTokens.typography.weightRegular,
    fontSize: 14,
    lineHeight: 20,
  },
  progressBlock: {
    gap: 6,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
  },
  percent: {
    fontFamily: DesignTokens.typography.weightSemiBold,
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  flexBtn: {
    flexGrow: 1,
    flexBasis: 140,
  },
});
