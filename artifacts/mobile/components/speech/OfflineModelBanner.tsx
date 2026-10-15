/**
 * Download prompt for the offline dictation model.
 * It sits above the navigation and does not replace the keyboard.
 */
import React, { useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import {
  confirmOfflineModelDownload,
  dismissOfflineModel,
  getOfflineModelView,
  retryOfflineModel,
  subscribeOfflineModel,
} from '@/lib/speech/offlineModelSession';
import { VOSK_MODELS } from '@/lib/speech/voskModels';
import * as Network from 'expo-network';
import type { NetworkKind } from '@/lib/speech/offlineModelFlow';

async function currentNetwork(): Promise<NetworkKind> {
  try {
    const state = await Network.getNetworkStateAsync();
    if (state.isConnected === false) return 'offline';
    if (state.type === Network.NetworkStateType.CELLULAR) return 'cellular';
    if (state.type === Network.NetworkStateType.WIFI) return 'wifi';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

function megabytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0';
  return String(Math.max(1, Math.round(bytes / 1_000_000)));
}

export function OfflineModelBanner() {
  const view = useSyncExternalStore(subscribeOfflineModel, getOfflineModelView, getOfflineModelView);
  const { t, language } = useTranslation();
  if (!view) return null;
  const spec = VOSK_MODELS[view.language];
  const size = language === 'en' ? `${spec.downloadMegabytes} MB` : `${spec.downloadMegabytes} Mo`;
  const installed = language === 'en'
    ? `${spec.installedMegabytes} MB`
    : `${spec.installedMegabytes} Mo`;
  const langName = view.language === 'en'
    ? (language === 'en' ? 'English' : 'anglais')
    : (language === 'en' ? 'French' : 'français');

  let body = t('speech.offlineDownloadBody', { lang: langName, size, installed });
  if (view.phase === 'ask' && view.cellular) {
    body = t('speech.offlineCellularBody', { size });
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
    else body = t('speech.offlineFailedNetwork');
  }

  const busy = view.phase === 'downloading' || view.phase === 'installing';

  return (
    <View style={styles.wrap} testID="offline-model-banner">
      <Text style={styles.title}>{t('speech.offlineDownloadTitle')}</Text>
      <Text style={styles.body}>{body}</Text>
      <View style={styles.row}>
        {view.phase === 'ask' ? (
          <Pressable
            style={styles.primary}
            testID="offline-model-download"
            onPress={() => {
              void currentNetwork().then((network) => confirmOfflineModelDownload(network));
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
            if (!busy || view.phase === 'downloading') dismissOfflineModel();
          }}
        >
          <Text style={styles.secondaryText}>{t('speech.offlineCancel')}</Text>
        </Pressable>
      </View>
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
