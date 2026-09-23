/**
 * DEV-only native Stockfish UCI smoke harness.
 * Route: /dev/stockfish-uci — not linked from production navigation.
 * Production (`__DEV__ === false`) Redirects to `/` and never starts the engine.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  Pressable,
  View,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Stack, Redirect } from 'expo-router';
import { requireOptionalNativeModule } from 'expo';
import { createUciTransport } from '@/lib/engines/stockfish/transport';
import {
  runUciSmokeTest,
  type UciHarnessLog,
} from '@/lib/engines/stockfish/uciHarness';
import type { UciTransport } from '@/lib/engines/stockfish/types';

type StockfishDiagnoseModule = {
  diagnose?: () => Record<string, unknown>;
};

function readNativeDiagnose(): Record<string, unknown> | null {
  if (Platform.OS !== 'android') return null;
  try {
    const bridge = requireOptionalNativeModule<StockfishDiagnoseModule>('StockfishUci');
    if (typeof bridge?.diagnose !== 'function') return null;
    const snapshot = bridge.diagnose();
    return snapshot && typeof snapshot === 'object' ? snapshot : null;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

const IS_DEV =
  typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

type Row = {
  id: string;
  label: string;
  status: 'idle' | 'ok' | 'fail' | 'running';
  detail?: string;
};

const INITIAL_ROWS: Row[] = [
  { id: 'start', label: 'Engine started', status: 'idle' },
  { id: 'uciok', label: 'uciok', status: 'idle' },
  { id: 'readyok', label: 'readyok', status: 'idle' },
  { id: 'info', label: 'info', status: 'idle' },
  { id: 'bestmove', label: 'bestmove', status: 'idle' },
  { id: 'stop', label: 'stop OK', status: 'idle' },
  { id: 'terminate', label: 'terminate OK', status: 'idle' },
];

function applyLogs(logs: UciHarnessLog[]): Row[] {
  return INITIAL_ROWS.map((row) => {
    const hit = [...logs].reverse().find((l) => l.step === row.id);
    if (!hit) return row;
    return {
      ...row,
      status: hit.ok ? 'ok' : 'fail',
      detail: hit.detail,
    };
  });
}

export default function NativeStockfishUciDevScreen() {
  const transportRef = useRef<UciTransport | null>(null);
  const [rows, setRows] = useState<Row[]>(INITIAL_ROWS);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bestmove, setBestmove] = useState<string | null>(null);
  const [diag, setDiag] = useState<Record<string, unknown> | null>(null);

  const cleanup = useCallback(() => {
    const transport = transportRef.current;
    transportRef.current = null;
    try {
      transport?.terminate();
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => cleanup, [cleanup]);

  useEffect(() => {
    setDiag(readNativeDiagnose());
  }, []);

  const run = useCallback(async () => {
    cleanup();
    setRunning(true);
    setError(null);
    setBestmove(null);
    setDiag(readNativeDiagnose());
    setRows(INITIAL_ROWS.map((row) => (row.id === 'start' ? { ...row, status: 'running' } : row)));

    let transport: UciTransport;
    try {
      if (Platform.OS !== 'android') {
        throw new Error('G1 native UCI harness is Android-only.');
      }
      transport = createUciTransport('native');
      transportRef.current = transport;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setRows(INITIAL_ROWS.map((row) => ({ ...row, status: 'fail' })));
      setRunning(false);
      return;
    }

    try {
      const result = await runUciSmokeTest(transport);
      setRows(applyLogs(result.logs));
      setBestmove(result.bestmove);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      if (err && typeof err === 'object' && 'step' in err) {
        const step = String((err as { step: string }).step);
        setRows((prev) =>
          prev.map((row) =>
            row.id === step
              ? { ...row, status: 'fail', detail: err instanceof Error ? err.message : String(err) }
              : row,
          ),
        );
      }
    } finally {
      setDiag(readNativeDiagnose());
      transportRef.current = null;
      setRunning(false);
    }
  }, [cleanup]);

  if (!IS_DEV) {
    return <Redirect href="/" />;
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: true, title: 'Stockfish UCI (dev)' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>G1 native transport harness — not a product screen</Text>
        <Pressable
          onPress={run}
          disabled={running}
          style={[styles.button, running && styles.buttonOff]}
        >
          {running ? (
            <ActivityIndicator color="#0B1728" />
          ) : (
            <Text style={styles.buttonText}>Run UCI smoke</Text>
          )}
        </Pressable>
        {rows.map((row) => (
          <View key={row.id} style={styles.row}>
            <Text
              style={[
                styles.badge,
                row.status === 'ok'
                  ? styles.badgeOk
                  : row.status === 'fail'
                    ? styles.badgeFail
                    : row.status === 'running'
                      ? styles.badgeRunning
                      : styles.badgeIdle,
              ]}
            >
              {row.status === 'ok' ? 'OK' : row.status === 'fail' ? 'FAIL' : row.status === 'running' ? '…' : '—'}
            </Text>
            <View style={styles.rowText}>
              <Text style={styles.label}>{row.label}</Text>
              {row.detail ? <Text style={styles.detail}>{row.detail}</Text> : null}
            </View>
          </View>
        ))}
        {bestmove ? <Text style={styles.mono}>{bestmove}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {diag ? (
          <View style={styles.diagBox}>
            <Text style={styles.diagTitle}>Spawn diagnose (DEV)</Text>
            <Text style={styles.diagBody}>
              {typeof diag.summary === 'string' ? diag.summary : JSON.stringify(diag, null, 2)}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B1728' },
  content: { padding: 16, gap: 10, paddingBottom: 48 },
  kicker: { color: '#5B7FA0', fontSize: 12, marginBottom: 4 },
  button: {
    backgroundColor: '#F5A623',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonOff: { opacity: 0.6 },
  buttonText: { color: '#0B1728', fontWeight: '700' },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  rowText: { flex: 1 },
  badge: {
    width: 48,
    textAlign: 'center',
    paddingVertical: 4,
    borderRadius: 4,
    overflow: 'hidden',
    color: '#DCE8F5',
    fontSize: 11,
    fontWeight: '700',
  },
  badgeIdle: { backgroundColor: '#1C3558' },
  badgeRunning: { backgroundColor: '#1F4080' },
  badgeOk: { backgroundColor: '#1F7A4D' },
  badgeFail: { backgroundColor: '#BE3030' },
  label: { color: '#DCE8F5', fontSize: 15 },
  detail: { color: '#5B7FA0', fontSize: 12, marginTop: 2, fontFamily: 'monospace' },
  mono: { color: '#cfc', fontFamily: 'monospace', fontSize: 13, marginTop: 8 },
  error: { color: '#F5A623', marginTop: 8, fontFamily: 'monospace' },
  diagBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#12233A',
  },
  diagTitle: { color: '#5B7FA0', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  diagBody: { color: '#9BB6CC', fontFamily: 'monospace', fontSize: 11, lineHeight: 16 },
});
