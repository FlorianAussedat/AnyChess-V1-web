/**
 * Shared engine status UI for endgame play screens.
 */
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Platform } from 'react-native';
import { useTranslation } from '@/hooks/useTranslation';
import { useColors } from '@/hooks/useColors';
import type { SharedStockfishSnapshot } from './SharedStockfishRuntime.ts';

type Props = {
  snapshot: SharedStockfishSnapshot;
  onRetry?: () => void;
  onBack?: () => void;
};

export function EndgameEngineStatusBanner({ snapshot, onRetry, onBack }: Props) {
  const { t } = useTranslation();
  const colors = useColors();

  if (snapshot.status === 'loading' || snapshot.status === 'uninitialized') {
    return (
      <View style={styles.row} testID="engine-status-loading">
        <ActivityIndicator color={colors.primary} size="small" />
        <Text style={{ color: colors.mutedForeground }}>
          {t('quiz.stockfishPreparing')}
        </Text>
      </View>
    );
  }

  if (snapshot.status === 'unavailable') {
    return (
      <View style={styles.errorBox} testID="engine-status-unavailable">
        <Text style={styles.errorText}>{t('quiz.stockfishNativeUnavailable')}</Text>
        {onBack && (
          <Pressable onPress={onBack} testID="engine-status-back">
            <Text style={{ color: colors.primary }}>{t('quiz.stockfishBack')}</Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (snapshot.status === 'error') {
    return (
      <View style={styles.errorBox} testID="engine-status-error">
        <Text style={styles.errorText}>{t('quiz.stockfishWebError')}</Text>
        {__DEV__ && !!snapshot.lastError && (
          <Text style={styles.devDetail} testID="engine-status-dev-detail">
            {t('quiz.stockfishDevDetail', {
              status: snapshot.status,
              error: snapshot.lastError,
              worker: snapshot.workerPath,
            })}
          </Text>
        )}
        <View style={styles.actions}>
          {onRetry && (
            <Pressable onPress={onRetry} testID="engine-status-retry">
              <Text style={{ color: colors.primary }}>{t('quiz.stockfishRetry')}</Text>
            </Pressable>
          )}
          {onBack && (
            <Pressable onPress={onBack} testID="engine-status-back">
              <Text style={{ color: colors.mutedForeground }}>{t('quiz.stockfishBack')}</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorBox: { gap: 8 },
  errorText: { color: '#c44' },
  devDetail: { color: '#888', fontSize: 11, fontFamily: Platform.select({ web: 'monospace', default: undefined }) },
  actions: { flexDirection: 'row', gap: 16 },
});
