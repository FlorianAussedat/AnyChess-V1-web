/**
 * Continue la ligne — recite repertoire continuations.
 * Query: /openings/continue?folderId=…
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useCancelSpeechOnLeave } from '@/hooks/useCancelSpeechOnLeave';
import { ChessMoveInput } from '@/components/game/ChessMoveInput';
import { ScreenHeader } from '@/components/ScreenHeader';
import { NumberedSanRows } from '@/components/moves/NumberedSanRows';
import { DiscreteSlider } from '@/components/ui/DiscreteSlider';
import { sideLabel } from '@/components/RepertoireSidePicker';
import { repertoireService, mixedTrainingKey, pickMixedLine, filterEntriesByReviewSide } from '@/lib/repertoire';
import type { ReviewSideFilter } from '@/lib/repertoire';
import { formatNumberedSan } from '@/lib/moves/formatNumberedSan';
import {
  formatNumberedSanForDisplay,
  formatSanForDisplay,
} from '@/lib/chess/notation';
import { usePreferences } from '@/hooks/usePreferences';
import { sanToVerbal } from '@/lib/chessParser';
import { parseChessVoice } from '@/lib/voice';
import { voiceSpeedSettings } from '@/lib/preferences/VoiceSpeedSettings';
import {
  ContinueLineSession,
  DEFAULT_VOICE_SPEED,
  VOICE_SPEED_MAX,
  VOICE_SPEED_MIN,
  continueLineNotationDisplay,
  voiceSpeedToRate,
  type ContinueLineSessionSnapshot,
} from '@/lib/continueLine';
import { continueLineRecentStorage } from '@/lib/continueLine/recentStore';
import { useSpeechInput } from '@/services/SpeechRecognitionService';
import { speechService } from '@/services/SpeechService';
import { useAudioSettings } from '@/hooks/useAudioSettings';

function formatLine(
  sans: string[],
  startPly = 0,
  notation: 'fr' | 'en' = 'fr',
): string {
  return sans
    .map((san, i) =>
      formatNumberedSanForDisplay(formatNumberedSan(startPly + i, san), notation),
    )
    .join('  ');
}

export default function ContinueLineScreen() {
  useCancelSpeechOnLeave('/openings/continue');
  const colors = useColors();
  const { t } = useTranslation();
  const { contentTop, contentBottom } = useAppSafeInsets();
  const router = useRouter();
  const { soundEnabled } = useAudioSettings();
  const { chessNotation } = usePreferences();

  const { folderId, folderIds, side: sideParam } = useLocalSearchParams<{
    folderId?: string;
    folderIds?: string;
    side?: string;
  }>();

  const reviewSide: ReviewSideFilter | null =
    sideParam === 'white' || sideParam === 'black' || sideParam === 'all'
      ? sideParam
      : null;

  const mixedFolderIds = folderIds
    ? folderIds.split(',').map((s) => s.trim()).filter(Boolean)
    : folderId
      ? [folderId]
      : [];
  const isMixed = mixedFolderIds.length > 1 || reviewSide === 'all';
  const recentKey = isMixed
    ? mixedTrainingKey(mixedFolderIds.length > 0 ? mixedFolderIds : [reviewSide ?? 'all'])
    : mixedFolderIds[0] ?? '';

  const sessionRef = useRef(new ContinueLineSession());
  const [snap, setSnap] = useState<ContinueLineSessionSnapshot>(
    () => sessionRef.current.snapshot(),
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceSpeed, setVoiceSpeed] = useState(DEFAULT_VOICE_SPEED);
  const voiceSpeedRef = useRef(voiceSpeed);
  // Session-local speed; seed from Profil default once (does not write back).
  useEffect(() => {
    let cancelled = false;
    voiceSpeedSettings.ensureLoaded().then(() => {
      if (!cancelled) setVoiceSpeed(voiceSpeedSettings.getDefaultSpeed());
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const folderIdRef = useRef(mixedFolderIds[0]);
  const activeFolderIdRef = useRef<string | null>(null);

  useEffect(() => {
    folderIdRef.current = mixedFolderIds[0];
  }, [mixedFolderIds.join(',')]);

  useEffect(() => {
    voiceSpeedRef.current = voiceSpeed;
  }, [voiceSpeed]);

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
      // Intentional session override: continue-line voice speed is local to this exercise.
      speechService.speak(text, {
        flush: true,
        rate: voiceSpeedToRate(voiceSpeedRef.current),
      });
    },
    [soundEnabled],
  );

  const startExercise = useCallback(async () => {
    if (mixedFolderIds.length === 0) {
      setLoadError(t('openings.folderIdMissing'));
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    setFeedback(null);
    try {
      await repertoireService.ensureLoaded();

      const entries = [];
      for (const id of mixedFolderIds) {
        const folder = repertoireService.getFolder(id);
        if (!folder) {
          setLoadError(t('openings.repertoireNotFound'));
          setLoading(false);
          return;
        }
        if (!folder.side) {
          setLoadError(t('openings.noSideAssigned', { name: folder.name }));
          setLoading(false);
          return;
        }
        const { repertoire: rep, fileCount, issues } =
          await repertoireService.buildFolderRepertoire(id);
        if (fileCount === 0 || rep.positionCount === 0) {
          setLoadError(
            issues[0]?.message ??
              t('openings.noPlayablePositions', { name: folder.name }),
          );
          setLoading(false);
          return;
        }
        entries.push({ folder, repertoire: rep });
      }

      const pool = reviewSide
        ? filterEntriesByReviewSide(entries, reviewSide)
        : entries;
      if (pool.length === 0) {
        setLoadError(
          reviewSide === 'white'
            ? t('openings.noWhiteToReview')
            : reviewSide === 'black'
              ? t('openings.noBlackToReview')
              : t('openings.noToReview'),
        );
        setLoading(false);
        return;
      }

      const recent = await continueLineRecentStorage.getRecentPathIds(recentKey);
      const session = sessionRef.current;
      const useMixed = isMixed || pool.length > 1;

      if (useMixed) {
        const pick = pickMixedLine(pool, { recentPathIds: recent });
        if (!pick) {
          setLoadError(t('openings.mixedPickFailed'));
          setLoading(false);
          return;
        }
        activeFolderIdRef.current = pick.folderId;
        session.start(pick.repertoire, pick.repertoireName, {
          recentPathIds: recent,
          sourceLabel: null,
          path: pick.path,
          folderId: pick.folderId,
          trainingSide: pick.side,
        });
      } else {
        const folder = pool[0].folder;
        activeFolderIdRef.current = folder.id;
        session.start(pool[0].repertoire, folder.name, {
          recentPathIds: recent,
          sourceLabel: null,
          folderId: folder.id,
          trainingSide: folder.side,
        });
      }

      let next = session.snapshot();
      if (next.phase === 'error') {
        setLoadError(next.errorMessage ?? t('openings.startFailed'));
        setLoading(false);
        setSnap(next);
        return;
      }

      const begun = session.beginRecitation();
      next = begun.snapshot;
      setSnap(next);
      setLoading(false);

      const pathId = session.getPathId();
      const activeId = activeFolderIdRef.current;
      if (pathId && activeId) {
        const storageId = useMixed ? `${activeId}:${pathId}` : pathId;
        await continueLineRecentStorage.pushRecentPathId(recentKey, storageId);
      }

      const sideHint = next.trainingSide ? ` (${sideLabel(next.trainingSide)})` : '';
      // No duplicate text card for the reference line — shown once as Ligne de départ.
      setFeedback(null);
      if (soundEnabled) {
        const verbalCue =
          next.preambleSans.length > 0
            ? next.preambleSans.map((s) => sanToVerbal(s)).join('. ') +
              '. ' +
              t('openings.continueSpeak', { side: sideHint })
            : t('openings.continueFromStartSpeak', { side: sideHint });
        speak(verbalCue);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }, [mixedFolderIds, isMixed, recentKey, reviewSide, soundEnabled, speak, t]);

  // Dedicated retry that keeps the current path if still available
  const retrySame = useCallback(async () => {
    if (mixedFolderIds.length === 0) return;
    setLoading(true);
    setFeedback(null);
    try {
      await repertoireService.ensureLoaded();
      const session = sessionRef.current;
      const path = session.getPath();
      const startPly = session.getStartPly();
      const activeId = activeFolderIdRef.current ?? mixedFolderIds[0];
      const folder = repertoireService.getFolder(activeId);
      if (!folder) {
        setLoadError(t('openings.repertoireNotFound'));
        setLoading(false);
        return;
      }
      const { repertoire: rep } = await repertoireService.buildFolderRepertoire(activeId);
      if (!path) {
        await startExercise();
        return;
      }
      session.start(rep, folder.name, {
        path,
        startPly,
        folderId: folder.id,
        trainingSide: folder.side,
      });
      const begun = session.beginRecitation();
      setSnap(begun.snapshot);
      setLoading(false);
      setFeedback(null);
      if (soundEnabled) {
        speak(
          begun.snapshot.preambleSans.length > 0
            ? begun.snapshot.preambleSans.map((s) => sanToVerbal(s)).join('. ') +
                '. ' +
                t('openings.continueSpeak', { side: '' })
            : t('openings.continueSpeak', { side: '' }),
        );
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }, [mixedFolderIds, soundEnabled, speak, startExercise, t]);

  useEffect(() => {
    startExercise();
    return () => {
      speechService.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mixedFolderIds.join(',')]);

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
            ? t('openings.ambiguousRetry')
            : t('openings.unrecognizedRetry'),
        );
        return;
      }
      if (parsed.type === 'illegal') {
        session.recordRecognitionFailure();
        setFeedback(t('openings.notPlayable'));
        return;
      }

      const move = parsed.move as Move;
      const result = session.applyChessMove(move);
      setSnap(result.snapshot);

      if (result.kind === 'correct') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        if (result.snapshot.phase === 'completed') {
          setFeedback(t('openings.lineComplete'));
          speak(t('openings.lineComplete'));
        } else {
          setFeedback(t('openings.okMove', { san: formatSanForDisplay(move.san, chessNotation) }));
        }
        return;
      }

      // wrong
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      const alts = result.snapshot.validAlternatives
        .map((s) =>
          formatNumberedSanForDisplay(
            formatNumberedSan(
              result.snapshot.startPly + result.snapshot.correctCount,
              s,
            ),
            chessNotation,
          ),
        )
        .join('\n• ');
      const suite = formatLine(
        result.snapshot.proposedContinuation,
        result.snapshot.startPly + result.snapshot.correctCount,
        chessNotation,
      );
      const played = formatNumberedSanForDisplay(
        formatNumberedSan(
          result.snapshot.startPly + result.snapshot.correctCount,
          result.snapshot.incorrectSan ?? '?',
        ),
        chessNotation,
      );
      setFeedback(
        `${t('openings.yourMove', { move: played })}\n\n` +
          `${t('openings.expectedOnLine')}\n• ${alts || t('openings.none')}\n\n` +
          `${t('openings.proposedContinuation')}\n${suite || t('openings.endOfLine')}`,
      );
      if (soundEnabled) {
        const verbal = t('openings.incorrectSpeak', {
          move: sanToVerbal(result.snapshot.incorrectSan ?? ''),
          suite: result.snapshot.proposedContinuation
            .map((s) => sanToVerbal(s))
            .join('. '),
        });
        speak(verbal);
      }
    },
    [chessNotation, soundEnabled, speak, t],
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

  const onPlayManual = useCallback((text: string) => {
    applyRef.current(text);
  }, []);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: contentTop }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={{ color: colors.mutedForeground, marginTop: 12 }}>{t('openings.preparing')}</Text>
      </View>
    );
  }

  if (loadError || snap.phase === 'error') {
    return (
      <View
        style={[
          styles.center,
          {
            backgroundColor: colors.background,
            paddingTop: contentTop,
            paddingHorizontal: 18,
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>{t('openings.continueLine')}</Text>
        <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginTop: 8 }}>
          {loadError ?? snap.errorMessage}
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={[styles.btn, { backgroundColor: colors.primary, marginTop: 20 }]}
        >
          <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold' }}>
            {t('openings.returnToRepertoire')}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: contentTop,
        paddingBottom: contentBottom,
        paddingHorizontal: 18,
        gap: 14,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <ScreenHeader
        onBack={() => router.back()}
        title={t('openings.continueLine')}
        subtitle={`${snap.repertoireName}${
          snap.trainingSide ? ` · ${sideLabel(snap.trainingSide)}` : ''
        }`}
        showSound
      />

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>{t('openings.status')}</Text>
        <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}>
          {snap.phase === 'reciting' && t('openings.yourTurnContinue')}
          {snap.phase === 'completed' && t('openings.lineComplete')}
          {snap.phase === 'failed' && t('openings.failed')}
        </Text>
        <Text style={{ color: colors.mutedForeground, marginTop: 4 }}>
          {t('openings.correctMoves', { count: snap.correctCount })}
        </Text>
      </View>

      {(() => {
        const notation = continueLineNotationDisplay(
          snap.preambleSans,
          snap.recitedSans,
          snap.correctCount,
        );
        if (notation.kind === 'none') {
          return (
            <View
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
              testID="continue-start-empty"
            >
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_400Regular' }}>
                {t('openings.fromStart', {
                  side: snap.trainingSide ? ` (${sideLabel(snap.trainingSide)})` : '',
                })}
              </Text>
            </View>
          );
        }
        return (
          <View
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            testID={
              notation.kind === 'start' ? 'continue-start-line' : 'continue-position-reached'
            }
          >
            <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>
              {notation.heading}
            </Text>
            <NumberedSanRows sans={notation.sans} testID="continue-san-rows" />
          </View>
        );
      })()}

      {feedback ? (
        <View
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          testID="continue-feedback"
        >
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_400Regular', lineHeight: 22 }}>
            {feedback}
          </Text>
        </View>
      ) : null}

      {!finished && (
        <>
          <DiscreteSlider
            testID="continue-voice-speed"
            label={t('openings.voiceSpeedRange')}
            valueLabel={String(voiceSpeed)}
            minimumValue={VOICE_SPEED_MIN}
            maximumValue={VOICE_SPEED_MAX}
            step={1}
            value={voiceSpeed}
            onValueChange={setVoiceSpeed}
            leftHint={t('openings.slow')}
            rightHint={t('openings.fast')}
            accessibilityLabel={t('a11y.voiceSpeed')}
          />

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
              {micActive ? t('a11y.listening') : t('a11y.speak')}
            </Text>
          </Pressable>
          {micStatus.message ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{micStatus.message}</Text>
          ) : null}

          <ChessMoveInput
            inputType="chess-move"
            onSubmit={onPlayManual}
            fen={snap.currentFen}
            enabled={snap.phase === 'reciting'}
            persistFocus={snap.phase === 'reciting'}
            placeholder={t('openings.movePlaceholder')}
            testID="continue-move-input"
          />
        </>
      )}

      {finished && (snap.phase === 'completed' || snap.phase === 'failed') && (
        <View style={{ gap: 10 }}>
          <Pressable
            onPress={() => retrySame()}
            style={[styles.btn, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
          >
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
              {t('openings.replaySameLine')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => startExercise()}
            style={[styles.btn, { backgroundColor: colors.primary }]}
          >
            <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold' }}>
              {t('openings.newLine')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() =>
              router.replace(
                (isMixed
                  ? '/openings'
                  : activeFolderIdRef.current
                    ? `/openings/${encodeURIComponent(activeFolderIdRef.current)}`
                    : '/openings') as Href,
              )
            }
            style={[styles.btn, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
          >
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
              {t('openings.returnToRepertoire')}
            </Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 4 },
  cardLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', textTransform: 'uppercase' },
  micBtn: {
    minHeight: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btn: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
});
