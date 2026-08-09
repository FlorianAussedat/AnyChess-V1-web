import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Chess } from 'chess.js';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { DesignTokens } from '@/constants/designTokens';
import { AppButton } from '@/components/ui/AppButton';
import { ChessMoveInput } from '@/components/game/ChessMoveInput';
import { ChessBoard } from '@/components/ChessBoard';
import { GameMicButton } from '@/components/game/GameMicButton';
import { fenFromSanHistory } from '@/lib/moveInput/keypadPromotion';
import { useBoardSize } from '@/hooks/useBoardSize';
import { useCancelSpeechOnLeave } from '@/hooks/useCancelSpeechOnLeave';
import { useColors } from '@/hooks/useColors';
import { usePreferences } from '@/hooks/usePreferences';
import { useTranslation } from '@/hooks/useTranslation';
import { formatSanForDisplay } from '@/lib/chess/notation';
import { useSpeechInput } from '@/services/SpeechRecognitionService';
import { replayLine, type ReplayLineHandle } from '@/lib/replay';
import {
  OpeningConstructionSession,
  openingFamilyNames,
  openingTargetsForFamily,
  pickRandomVariation,
  type OpeningTarget,
  type PlayerConstructionSnapshot,
} from '@/lib/openingQuiz';
import type { BoardPiece } from '@/contexts/GameContext';

/** Slower teaching replay after a wrong answer. */
const WRONG_REPLAY_INTERVAL_MS = 2000;
/** Faster celebration / review after a successful construction. */
const SUCCESS_REPLAY_INTERVAL_MS = 1000;

function makeSession(target: OpeningTarget): OpeningConstructionSession {
  return new OpeningConstructionSession(target);
}

function Dropdown({
  label,
  value,
  options,
  onSelect,
  testID,
}: {
  label: string;
  value: string;
  options: string[];
  onSelect: (v: string) => void;
  testID?: string;
}) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 4 }} testID={testID}>
      <Text
        style={{
          color: colors.mutedForeground,
          fontSize: 11,
          fontFamily: DesignTokens.typography.weightSemiBold,
          letterSpacing: 0.4,
        }}
      >
        {label}
      </Text>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 10,
          minHeight: 40,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          backgroundColor: colors.card,
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: colors.foreground, fontSize: 14 }} numberOfLines={2}>
          {value}
        </Text>
      </Pressable>
      {open && (
        <View
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            maxHeight: 180,
            backgroundColor: colors.card,
          }}
        >
          <ScrollView nestedScrollEnabled>
            {options.map((opt) => (
              <Pressable
                key={opt}
                onPress={() => {
                  onSelect(opt);
                  setOpen(false);
                }}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 9,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                  backgroundColor: opt === value ? colors.primary : colors.card,
                }}
              >
                <Text
                  style={{
                    color: opt === value ? colors.primaryForeground : colors.foreground,
                    fontSize: 13,
                  }}
                >
                  {opt}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

export default function ConstruisOuvertureScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { chessNotation } = usePreferences();
  const { top: topPad, bottom: bottomPad } = useAppSafeInsets();
  const boardSize = useBoardSize('wide');
  const router = useRouter();
  useCancelSpeechOnLeave('/quiz-ouverture/construis');

  const families = useMemo(() => openingFamilyNames(), []);
  const [family, setFamily] = useState(families[0] ?? '');
  const variations = useMemo(() => openingTargetsForFamily(family), [family]);
  const [target, setTarget] = useState<OpeningTarget | null>(variations[0] ?? null);
  const session = useRef(target ? makeSession(target) : null);
  const replayHandle = useRef<ReplayLineHandle | null>(null);
  const [snap, setSnap] = useState<PlayerConstructionSnapshot | null>(() =>
    session.current?.snapshotForPlayer() ?? null,
  );
  const [replayBoard, setReplayBoard] = useState<(BoardPiece | null)[][] | null>(null);
  const [replayLastMove, setReplayLastMove] = useState<{ from: string; to: string } | null>(null);
  const [isReplaying, setIsReplaying] = useState(false);
  const [postReplayHint, setPostReplayHint] = useState<string | null>(null);
  const [touchSelected, setTouchSelected] = useState<string | null>(null);
  const [legalDests, setLegalDests] = useState<string[]>([]);
  const [configExpanded, setConfigExpanded] = useState(true);
  const [showRecognizedFlash, setShowRecognizedFlash] = useState(false);

  const inTraining = !!target && !configExpanded;

  useEffect(() => {
    return () => {
      replayHandle.current?.cancel();
    };
  }, []);

  function clearTouch() {
    setTouchSelected(null);
    setLegalDests([]);
  }

  function resetSession(next: OpeningTarget | null) {
    setTarget(next);
    session.current = next ? makeSession(next) : null;
    setSnap(session.current?.snapshotForPlayer() ?? null);
    replayHandle.current?.cancel();
    setReplayBoard(null);
    setReplayLastMove(null);
    setIsReplaying(false);
    setPostReplayHint(null);
    clearTouch();
    setConfigExpanded(false);
  }

  function selectFamily(nextFamily: string) {
    setFamily(nextFamily);
    const vars = openingTargetsForFamily(nextFamily);
    resetSession(vars[0] ?? null);
  }

  function selectVariation(name: string) {
    const next = variations.find((v) => v.identity.name === name) ?? null;
    resetSession(next);
  }

  function pickRandom() {
    const pick = pickRandomVariation();
    if (!pick) return;
    setFamily(pick.family);
    const nextTarget = { identity: pick.line.identity, sans: pick.line.sans };
    resetSession(nextTarget);
  }

  function startReplay(line: string[], intervalMs: number, opts?: { promptRestart?: boolean }) {
    replayHandle.current?.cancel();
    setIsReplaying(true);
    setPostReplayHint(null);
    clearTouch();
    const promptRestart = opts?.promptRestart ?? false;
    replayHandle.current = replayLine({
      moves: line,
      intervalMs,
      onPosition: (fen) => {
        const game = new Chess(fen);
        setReplayBoard(game.board() as (BoardPiece | null)[][]);
      },
      onMove: (m) => {
        setReplayLastMove({ from: m.from, to: m.to });
      },
      onComplete: () => {
        setIsReplaying(false);
        if (promptRestart) setPostReplayHint(t('quiz.yourTurnRestart'));
      },
    });
  }

  function reviewOpening() {
    if (!target) return;
    startReplay(target.sans, WRONG_REPLAY_INTERVAL_MS, { promptRestart: true });
  }

  function restartTraining() {
    if (!session.current) return;
    replayHandle.current?.cancel();
    setReplayBoard(null);
    setReplayLastMove(null);
    setIsReplaying(false);
    setPostReplayHint(null);
    clearTouch();
    setSnap(session.current.restart());
  }

  function onChanger() {
    replayHandle.current?.cancel();
    setReplayBoard(null);
    setReplayLastMove(null);
    setIsReplaying(false);
    setPostReplayHint(null);
    clearTouch();
    setConfigExpanded(true);
  }

  function applySnapshot(next: ReturnType<OpeningConstructionSession['answer']>) {
    setSnap(session.current?.snapshotForPlayer() ?? null);
    clearTouch();
    if (next.phase === 'wrong') {
      startReplay(next.target.sans, WRONG_REPLAY_INTERVAL_MS, { promptRestart: true });
    } else if (next.phase === 'complete') {
      startReplay(next.target.sans, SUCCESS_REPLAY_INTERVAL_MS);
    }
  }

  function answer(raw: string) {
    if (!session.current) return;
    applySnapshot(session.current.answer(raw));
  }

  const canTouch = snap?.phase === 'playing' && !isReplaying && inTraining;

  function onSquarePress(square: string) {
    if (!canTouch || !session.current) return;
    if (touchSelected === null) {
      const dests = session.current.getLegalDestinations(square);
      if (dests.length > 0) {
        setTouchSelected(square);
        setLegalDests(dests);
      }
    } else if (square === touchSelected) {
      clearTouch();
    } else if (legalDests.includes(square)) {
      applySnapshot(session.current.attemptMove({ from: touchSelected, to: square }));
    } else {
      const dests = session.current.getLegalDestinations(square);
      if (dests.length > 0) {
        setTouchSelected(square);
        setLegalDests(dests);
      } else {
        clearTouch();
      }
    }
  }

  const { micActive, isListening, status: micStatus, toggleMic } = useSpeechInput({
    forceOff: snap?.phase !== 'playing' || isReplaying || !inTraining,
    isSpeaking: false,
    onTranscript: (raw) => {
      setShowRecognizedFlash(true);
      setTimeout(() => setShowRecognizedFlash(false), 900);
      answer(raw);
    },
  });

  const boardToShow =
    replayBoard ??
    (session.current?.getBoard() as (BoardPiece | null)[][] | undefined) ??
    null;

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: DesignTokens.spacing.xl,
        paddingTop: topPad + DesignTokens.spacing.md,
        paddingBottom: bottomPad + DesignTokens.spacing.xl,
        gap: DesignTokens.spacing.md,
        backgroundColor: colors.background,
      }}
      keyboardShouldPersistTaps="handled"
      testID="construis-screen"
    >
      <ScreenHeader
        onBack={() => {
          replayHandle.current?.cancel();
          router.back();
        }}
        title={t('quiz.construis')}
        subtitle={inTraining ? undefined : t('quiz.buildSubtitle')}
        showSound
      />

      {configExpanded && (
        <View style={{ gap: 8 }} testID="construis-selection">
          <Dropdown
            label={t('quiz.opening')}
            value={family}
            options={families}
            onSelect={selectFamily}
            testID="construis-family"
          />
          {variations.length > 0 && target && (
            <Dropdown
              label={t('quiz.variation')}
              value={target.identity.name}
              options={variations.map((v) => v.identity.name)}
              onSelect={selectVariation}
              testID="construis-variation"
            />
          )}
          <AppButton
            label={t('common.random')}
            onPress={pickRandom}
            variant="secondary"
            testID="construis-random"
          />
        </View>
      )}

      {inTraining && target && (
        <View
          style={[
            styles.summary,
            { borderColor: colors.border, backgroundColor: colors.card },
          ]}
          testID="construis-summary"
        >
          <Text
            style={{
              flex: 1,
              color: colors.foreground,
              fontFamily: DesignTokens.typography.weightSemiBold,
              fontSize: 13,
            }}
            numberOfLines={2}
          >
            {family} · {target.identity.name}
          </Text>
          <Pressable
            onPress={onChanger}
            hitSlop={8}
            style={({ pressed }) => [
              styles.changer,
              {
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            testID="construis-changer"
          >
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: DesignTokens.typography.weightSemiBold,
                fontSize: 13,
              }}
            >
              {t('quiz.change')}
            </Text>
          </Pressable>
        </View>
      )}

      {inTraining && boardToShow && (
        <View
          style={{
            alignItems: 'center',
            alignSelf: 'center',
            width: boardSize,
          }}
          testID="construis-board"
        >
          <ChessBoard
            board={boardToShow}
            lastMove={replayLastMove}
            selectedSquare={canTouch ? touchSelected : null}
            legalDots={canTouch ? legalDests : []}
            onSquarePress={canTouch ? onSquarePress : () => {}}
            sizeMode="wide"
            size={boardSize}
          />
        </View>
      )}

      {inTraining && snap && (
        <View style={{ gap: 10 }}>
          <Text style={{ color: colors.mutedForeground }}>
            {t('quiz.played', {
              moves:
                snap.playedSans
                  .map((san) => formatSanForDisplay(san, chessNotation))
                  .join(' ') || '—',
            })}
          </Text>

          {snap.phase === 'playing' && !!snap.feedback && (
            <Text
              style={{
                color:
                  snap.feedback === t('quiz.correct')
                    ? '#398a55'
                    : colors.mutedForeground,
                fontFamily:
                  snap.feedback === t('quiz.correct')
                    ? DesignTokens.typography.weightSemiBold
                    : DesignTokens.typography.weightRegular,
              }}
            >
              {snap.feedback}
            </Text>
          )}

          {snap.phase === 'wrong' && (
            <View style={{ gap: 4 }} testID="construis-wrong-feedback">
              <Text
                style={{
                  color: '#c44',
                  fontFamily: DesignTokens.typography.weightSemiBold,
                  fontSize: 16,
                }}
              >
                {t('common.incorrect')}
              </Text>
              {!!snap.expectedSan && (
                <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}>
                  {t('quiz.expected', {
                    san: formatSanForDisplay(snap.expectedSan, chessNotation),
                  })}
                </Text>
              )}
            </View>
          )}

          {snap.phase === 'complete' && (
            <Text
              style={{
                color: '#398a55',
                fontFamily: DesignTokens.typography.weightSemiBold,
                fontSize: 16,
              }}
            >
              {snap.feedback}
            </Text>
          )}

          {isReplaying && (
            <Text style={{ color: colors.mutedForeground }} testID="construis-replaying">
              {t('quiz.replaying')}
            </Text>
          )}

          {!isReplaying && !!postReplayHint && (
            <Text style={{ color: colors.primary, fontFamily: DesignTokens.typography.weightSemiBold }}>
              {postReplayHint}
            </Text>
          )}

          {snap.phase === 'playing' ? (
            <>
              <ChessMoveInput
                inputType="chess-move"
                onSubmit={answer}
                fen={fenFromSanHistory(snap.playedSans)}
                enabled={!isReplaying}
                persistFocus
                placeholder={t('quiz.dictatePlaceholder')}
                testID="construis-move-input"
              />
              <GameMicButton
                showRecognized={showRecognizedFlash}
                isListening={isListening}
                micActive={micActive}
                micMessage={micStatus.message}
                onToggle={toggleMic}
                testID="construis-mic"
              />
            </>
          ) : (
            <View style={{ gap: 8 }}>
              <AppButton
                label={t('quiz.reviewOpening')}
                variant="secondary"
                onPress={reviewOpening}
                disabled={isReplaying}
                testID="construis-review"
              />
              <AppButton
                label={t('common.restart')}
                onPress={restartTraining}
                disabled={isReplaying}
                testID="construis-restart"
              />
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  changer: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
});
