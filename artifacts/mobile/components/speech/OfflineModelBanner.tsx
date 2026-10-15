/**
 * Download prompt for one offline dictation model.
 * It sits above the navigation and does not replace the keyboard.
 * Closing the mobile-data dialog, or the Android back key, does not start the transfer.
 */
import React, { useEffect, useSyncExternalStore } from 'react';
import { BackHandler, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
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
import { formatDownloadSize, VOSK_MODELS } from '@/lib/speech/voskModels';
import * as Network from 'expo-network';
import { networkKindFromState, type NetworkKind } from '@/lib/speech/offlineModelFlow';

async function currentNetwork(): Promise<NetworkKind> {
  try {
    return networkKindFromState(await Network.getNetworkStateAsync());
  } catch {
    return 'unknown';
  }
}

function megabytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0';
  return (bytes / 1_000_000).toFixed(1);
}

export function OfflineModelBanner() {
  const view = useSyncExternalStore(subscribeOfflineModel, getOfflineModelView, getOfflineModelView);
  const { t, language } = useTranslation();

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
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (view.phase === 'installing') return true;
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
  const size = formatDownloadSize(spec.downloadBytes, language === 'en' ? 'en' : 'fr');
  const installed = formatDownloadSize(spec.installedBytes, language === 'en' ? 'en' : 'fr');
  const langName = view.language === 'en'
    ? (language === 'en' ? 'English' : 'anglais')
    : (language === 'en' ? 'French' : 'français');

  let body = t('speech.offlineDownloadBody', { lang: langName, size, installed });
  if (view.phase === 'waiting-wifi') {
    body = t('speech.offlineWaiting', { lang: langName, size });
  } else if (view.phase === 'downloading') {
    const progress = view.total > 0
      ? `${megabytes(view.received)} / ${megabytes(view.total)}`
      : megabytes(view.received);
    body = t('speech.offlineProgress', { progress });
  } else if (view.phase === 'installing') {
    body = t('speech.offlineInstalling');
  } else if (view.phase === 'error') {
    if (view.reason === 'space') body = t('speech.offlineFailedSpace');
    else if (view.reason === 'integrity' || view.reason === 'incompatible') {
      body = t('speech.offlineFailedIntegrity');
    } else if (view.reason === 'offline') body = t('speech.offlineFailedOffline');
    else if (view.reason === 'cancelled') body = t('speech.offlineCancel');
    else body = t('speech.offlineFailedNetwork');
  }

  const cellular = view.phase === 'cellular-ask';

  return (
    <View>
      <Modal
        visible={cellular}
        transparent
        animationType="fade"
        onRequestClose={() => dismissOfflineModel()}
      >
        <View style={styles.backdrop}>
          <View style={styles.dialog} testID="offline-model-cellular">
            <Text style={styles.title}>{t('speech.offlineCellularTitle')}</Text>
            <Text style={styles.body}>
              {t('speech.offlineCellularBody', { lang: langName, size })}
            </Text>
            <View style={styles.row}>
              <Pressable
                style={styles.secondary}
                testID="offline-model-wait-wifi"
                onPress={() => waitOfflineForWifi()}
              >
                <Text style={styles.secondaryText}>{t('speech.offlineWaitWifi')}</Text>
              </Pressable>
              <Pressable
                style={styles.primary}
                testID="offline-model-download-mobile"
                onPress={() => {
                  void currentNetwork().then((network) => requestOfflineMobileDownload(network));
                }}
              >
                <Text style={styles.primaryText}>{t('speech.offlineDownload')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      {cellular ? null : (
        <View style={styles.wrap} testID="offline-model-banner">
          <Text style={styles.title}>{t('speech.offlineDownloadTitle')}</Text>
          <Text style={styles.body}>{body}</Text>
          <View style={styles.row}>
            {view.phase === 'ask' ? (
              <Pressable
                style={styles.primary}
                testID="offline-model-download"
                onPress={() => {
                  void currentNetwork().then((network) => requestOfflineDownload(network));
                }}
              >
                <Text style={styles.primaryText}>{t('speech.offlineDownload')}</Text>
              </Pressable>
            ) : null}
            {view.phase === 'error' ? (
              <Pressable
                style={styles.primary}
                testID="offline-model-retry"
                onPress={() => {
                  void currentNetwork().then((network) => retryOfflineModel(network));
                }}
              >
                <Text style={styles.primaryText}>{t('speech.offlineRetry')}</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={styles.secondary}
              testID="offline-model-cancel"
              disabled={view.phase === 'installing'}
              onPress={() => {
                if (view.phase === 'downloading') cancelOfflineModel();
                else if (view.phase !== 'installing') dismissOfflineModel();
              }}
            >
              <Text style={styles.secondaryText}>{t('speech.offlineCancel')}</Text>
            </Pressable>
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
    backgroundColor: '#13283F',
    gap: 8,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 18, 0.72)',
    justifyContent: 'center',
    padding: 24,
  },
  dialog: {
    backgroundColor: '#102040',
    borderRadius: DesignTokens.radius.md,
    padding: DesignTokens.spacing.md,
    gap: 12,
  },
  title: {
    color: '#F4F7FB',
    fontWeight: '700',
    fontSize: 16,
  },
  body: {
    color: '#D5DEE8',
    fontSize: 14,
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  primary: {
    backgroundColor: '#3DDC97',
    borderRadius: DesignTokens.radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  primaryText: {
    color: '#062015',
    fontWeight: '700',
  },
  secondary: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  secondaryText: {
    color: '#F4F7FB',
  },
});
