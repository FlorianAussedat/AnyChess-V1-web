/**
 * Continue la ligne — recite repertoire continuations.
 * Query: /openings/continue?folderId=…
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { useColors } from '@/hooks/useColors';
import { repertoireService } from '@/lib/repertoire';
import { formatNumberedSan } from '@/lib/moves/formatNumberedSan';
import { sanToVerbal } from '@/lib/chessParser';
import { parseChessVoice } from '@/lib/voice';
import {
  ContinueLineSession,
  type ContinueLineSessionSnapshot,
} from '@/lib/continueLine';
import { continueLineRecentStorage } from '@/lib/continueLine/recentStore';
import { useSpeechInput } from '@/services/SpeechRecognitionService';
import { speechService } from '@/services/SpeechService';
import { useAudioSettings } from '@/hooks/useAudioSettings';

function formatLine(sans: string[], startPly = 0): string {
  return sans
    .map((san, i) => formatNumberedSan(startPly + i, san))
    .join('  ');
}

export default function ContinueLineScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom;
  const { soundEnabled } = useAudioSettings();

  const { folderId } = useLocalSearchParams<{ folderId: string }>();

  const sessionRef = useRef(new ContinueLineSession());
  const [snap, setSnap] = useState<ContinueLineSessionSnapshot>(
    () => sessionRef.current.snapshot(),
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [manualText, setManualText] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const folderIdRef = useRef(folderId);

  useEffect(() => {
    folderIdRef.current = folderId;
  }, [folderId]);

  useEffect(() => {
    const unsub = speechService.onSpeakingChange(setIsSpeaking);
    return () => {
      unsub();
      speechService.stop();
    };
  }, []);

  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    }).catch(() => {});
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!soundEnabled) return;
      speechService.speak(text, { flush: true });
    },
    [soundEnabled],
  );

  const startExercise = useCallback(async () => {
    if (!folderId) {
      setLoadError('Dossier manquant.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    setFeedback(null);
    try {
      await repertoireService.ensureLoaded();
      const folder = repertoireService.getFolder(folderId);
      if (!folder) {
        setLoadError('Répertoire introuvable.');
        setLoading(false);
        return;
      }
      const { repertoire: rep, fileCount, issues } =
        await repertoireService.buildFolderRepertoire(folderId);
      if (fileCount === 0 || rep.positionCount === 0) {
        setLoadError(
          issues[0]?.message ??
            'Ce répertoire ne contient aucune position jouable.',
        );
        setLoading(false);
        return;
      }

      const recent = await continueLineRecentStorage.getRecentPathIds(folderId);
      const session = sessionRef.current;

      session.start(rep, folder.name, {
        recentPathIds: recent,
        sourceLabel: null,
      });

      let next = session.snapshot();
      if (next.phase === 'error') {
        setLoadError(next.errorMessage ?? 'Impossible de démarrer.');
        setLoading(false);
        setSnap(next);
        return;
      }

      next = session.beginRecitation();
      setSnap(next);
      setLoading(false);

      const pathId = session.getPathId();
      if (pathId) {
        await continueLineRecentStorage.pushRecentPathId(folderId, pathId);
      }

      const preamble = formatLine(next.preambleSans, 0);
      const intro =
        next.preambleSans.length > 0
          ? `${preamble}. Continue la ligne.`
          : 'Continue la ligne depuis le début.';
      setFeedback(intro);
      if (soundEnabled) {
        const verbalCue =
          next.preambleSans.length > 0
            ? next.preambleSans.map((s) => sanToVerbal(s)).join('. ') +
              '. Continue la ligne.'
            : 'Continue la ligne.';
        speak(verbalCue);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }, [folderId, soundEnabled, speak]);

  // Dedicated retry that keeps the current path if still available
  const retrySame = useCallback(async () => {
    if (!folderId) return;
    setLoading(true);
    setFeedback(null);
    try {
      await repertoireService.ensureLoaded();
      const folder = repertoireService.getFolder(folderId);
      if (!folder) {
        setLoadError('Répertoire introuvable.');
        setLoading(false);
        return;
      }
      const { repertoire: rep } = await repertoireService.buildFolderRepertoire(folderId);
      const session = sessionRef.current;
      const path = session.getPath();
      const startPly = session.getStartPly();
      if (!path) {
        await startExercise();
        return;
      }
      session.start(rep, folder.name, { path, startPly });
      const next = session.beginRecitation();
      setSnap(next);
      setLoading(false);
      const preamble = formatLine(next.preambleSans, 0);
      const intro =
        next.preambleSans.length > 0
          ? `${preamble}. Continue la ligne.`
          : 'Continue la ligne depuis le début.';
      setFeedback(intro);
      if (soundEnabled) {
        speak(
          next.preambleSans.length > 0
            ? next.preambleSans.map((s) => sanToVerbal(s)).join('. ') + '. Continue la ligne.'
            : 'Continue la ligne.',
        );
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }, [folderId, soundEnabled, speak, startExercise]);

  useEffect(() => {
    startExercise();
    return () => {
      speechService.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId]);

  const applyRaw = useCallback(
    (raw: string) => {
      const session = sessionRef.current;
      if (session.snapshot().phase !== 'reciting') return;

      const probe = new Chess(session.snapshot().currentFen);
      const parsed = parseChessVoice(raw, probe, { mode: 'opening' });

      if (parsed.type === 'command') {
        // Ignore app commands during this exercise
        return;
      }
      if (parsed.type === 'unrecognized' || parsed.type === 'ambiguous') {
        session.recordRecognitionFailure();
        setFeedback(
          parsed.type === 'ambiguous'
            ? 'Ambigu — reformule le coup (non compté comme erreur).'
            : 'Non reconnu — réessaie (non compté comme erreur).',
        );
        return;
      }
      if (parsed.type === 'illegal') {
        session.recordRecognitionFailure();
        setFeedback('Coup non jouable ici — réessaie.');
        return;
      }

      const move = parsed.move as Move;
      // Ensure move object has san — chess.js Move does
      const result = session.applyChessMove(move);
      setSnap(result.snapshot);

      if (result.kind === 'correct') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        if (result.snapshot.phase === 'completed') {
          setFeedback('Ligne complète.');
          speak('Ligne complète.');
        } else {
          setFeedback(`OK : ${move.san}`);
        }
        return;
      }

      // wrong
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      const alts = result.snapshot.validAlternatives
        .map((s) => formatNumberedSan(result.snapshot.startPly + result.snapshot.correctCount, s))
        .join('\n• ');
      const suite = formatLine(
        result.snapshot.proposedContinuation,
        result.snapshot.startPly + result.snapshot.correctCount,
      );
      setFeedback(
        `Votre coup : ${formatNumberedSan(result.snapshot.startPly + result.snapshot.correctCount, result.snapshot.incorrectSan ?? '?')}\n\n` +
          `Coups du répertoire disponibles :\n• ${alts || '(aucun)'}\n\n` +
          `Suite proposée :\n${suite || '(fin de ligne)'}`,
      );
      if (soundEnabled) {
        const verbal =
          `Incorrect. Votre coup : ${sanToVerbal(result.snapshot.incorrectSan ?? '')}. ` +
          `Suite proposée : ` +
          result.snapshot.proposedContinuation.map((s) => sanToVerbal(s)).join('. ');
        speak(verbal);
      }
    },
    [soundEnabled, speak],
  );

  const applyRef = useRef(applyRaw);
  useEffect(() => {
    applyRef.current = applyRaw;
  }, [applyRaw]);

  const finished =
    snap.phase === 'completed' || snap.phase === 'failed' || snap.phase === 'error';

  const { micActive, isListening, status: micStatus, toggleMic } = useSpeechInput({
    isSpeaking,
    forceOff: finished || loading,
    onTranscript: (text) => applyRef.current(text),
  });

  const onPlayManual = useCallback(() => {
    const text = manualText.trim();
    if (!text) return;
    applyRef.current(text);
    setManualText('');
  }, [manualText]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={{ color: colors.mutedForeground, marginTop: 12 }}>Préparation…</Text>
      </View>
    );
  }

  if (loadError || snap.phase === 'error') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: topPad, paddingHorizontal: 18 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Continue la ligne</Text>
        <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginTop: 8 }}>
          {loadError ?? snap.errorMessage}
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={[styles.btn, { backgroundColor: colors.primary, marginTop: 20 }]}
        >
          <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold' }}>
            Retour au répertoire
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: topPad + 12,
        paddingBottom: bottomPad + 24,
        paddingHorizontal: 18,
        gap: 14,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={[styles.back, { borderColor: colors.border, backgroundColor: colors.card }]}
        >
          <Ionicons name="chevron-back" size={20} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Continue la ligne</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{snap.repertoireName}</Text>
        </View>
      </View>

      {snap.preambleSans.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>Position atteinte</Text>
          <Text style={[styles.mono, { color: colors.foreground }]}>
            {formatLine(snap.preambleSans, 0)}
          </Text>
        </View>
      )}

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>Statut</Text>
        <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}>
          {snap.phase === 'reciting' && 'À toi de continuer'}
          {snap.phase === 'completed' && 'Ligne complète'}
          {snap.phase === 'failed' && 'Erreur — exercice arrêté'}
        </Text>
        <Text style={{ color: colors.mutedForeground, marginTop: 4 }}>
          Coups corrects : {snap.correctCount}
        </Text>
      </View>

      {feedback ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_400Regular', lineHeight: 22 }}>
            {feedback}
          </Text>
        </View>
      ) : null}

      {!finished && (
        <>
          <Pressable
            onPress={toggleMic}
            testID="continue-mic"
            style={({ pressed }) => [
              styles.micBtn,
              {
                backgroundColor: micActive ? '#C44' : colors.primary,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Ionicons
              name={isListening || micActive ? 'mic' : 'mic-outline'}
              size={22}
              color={colors.primaryForeground}
            />
            <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold' }}>
              {micActive ? 'Écoute…' : 'Parler'}
            </Text>
          </Pressable>
          {micStatus.message ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{micStatus.message}</Text>
          ) : null}

          <View style={styles.manualRow}>
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                },
              ]}
              placeholder="Ex. Cf3, petit roque, e4…"
              placeholderTextColor={colors.mutedForeground}
              value={manualText}
              onChangeText={setManualText}
              onSubmitEditing={onPlayManual}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              onPress={onPlayManual}
              style={[styles.sendBtn, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="send" size={18} color={colors.primaryForeground} />
            </Pressable>
          </View>
        </>
      )}

      {finished && (snap.phase === 'completed' || snap.phase === 'failed') && (
        <View style={{ gap: 10 }}>
          <Pressable
            onPress={() => retrySame()}
            style={[styles.btn, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
          >
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
              Rejouer la même ligne
            </Text>
          </Pressable>
          <Pressable
            onPress={() => startExercise()}
            style={[styles.btn, { backgroundColor: colors.primary }]}
          >
            <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold' }}>
              Nouvelle ligne
            </Text>
          </Pressable>
          <Pressable
            onPress={() =>
              router.replace(
                (folderId
                  ? `/openings/${encodeURIComponent(folderId)}`
                  : '/openings') as Href,
              )
            }
            style={[styles.btn, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
          >
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
              Retour au répertoire
            </Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 4 },
  cardLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', textTransform: 'uppercase' },
  mono: { fontFamily: 'Inter_500Medium', fontSize: 15, lineHeight: 22 },
  micBtn: {
    minHeight: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  manualRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontFamily: 'Inter_400Regular',
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btn: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
});
