/**
 * Development-only voice parser diagnostic screen.
 * Reachable at /dev/voice-parser when __DEV__ is true.
 * Not linked from the production home / mode list.
 */
import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  View,
} from 'react-native';
import { Stack, Redirect } from 'expo-router';
import { Chess } from 'chess.js';
import { diagnoseVoiceTranscript, formatVoiceDiagnostic } from '@/lib/voice';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const IS_DEV = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

export default function VoiceParserDiagScreen() {
  const [fen, setFen] = useState(START_FEN);
  const [raw, setRaw] = useState('cavalier effet trois');
  const [mode, setMode] = useState<'classic' | 'puzzle' | 'blind' | 'any'>('classic');

  const report = useMemo(() => {
    if (!IS_DEV) return '';
    try {
      const game = new Chess(fen.trim());
      const d = diagnoseVoiceTranscript(raw, game, { mode });
      return formatVoiceDiagnostic(d);
    } catch (err) {
      return `Invalid FEN or parse error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }, [fen, raw, mode]);

  if (!IS_DEV) {
    return <Redirect href="/" />;
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: true, title: 'Voice parser (dev)' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>FEN</Text>
        <TextInput
          style={styles.input}
          value={fen}
          onChangeText={setFen}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.label}>Raw transcript</Text>
        <TextInput
          style={styles.input}
          value={raw}
          onChangeText={setRaw}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.label}>Mode</Text>
        <View style={styles.row}>
          {(['classic', 'puzzle', 'blind', 'any'] as const).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={[styles.chip, mode === m && styles.chipOn]}
            >
              <Text style={styles.chipText}>{m}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Result</Text>
        <Text style={styles.mono}>{report}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a1a1a' },
  content: { padding: 16, gap: 8 },
  label: { color: '#aaa', fontSize: 12, marginTop: 8 },
  input: {
    backgroundColor: '#2a2a2a',
    color: '#eee',
    padding: 10,
    borderRadius: 6,
    fontFamily: 'monospace',
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#333',
  },
  chipOn: { backgroundColor: '#4a7' },
  chipText: { color: '#fff', fontSize: 12 },
  mono: {
    color: '#cfc',
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
  },
});
