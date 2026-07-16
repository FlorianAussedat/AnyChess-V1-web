import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { ChessBoard } from '@/components/ChessBoard';
import { ChessAnswerInput } from '@/components/ChessAnswerInput';
import { BoardCoordinatesToggle } from '@/components/BoardCoordinatesToggle';
import { SoundToggle } from '@/components/SoundToggle';
import {
  BlindSequenceProvider,
  useBlindSequence,
} from '@/contexts/BlindSequenceContext';
import { halfMoveCount, type BlindOrientation, type DictationPace, type ObservationPace } from '@/lib/blind';
import { useSpeechInput } from '@/services/SpeechRecognitionService';
import { useAudioSettings } from '@/hooks/useAudioSettings';
import { useBoardCoordinates } from '@/hooks/useBoardCoordinates';

const FULL_MOVE_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1);

export default function BlindRoute() {
  return (
    <BlindSequenceProvider>
      <BlindSequenceScreen />
    </BlindSequenceProvider>
  );
}

function BlindSequenceScreen() {
  const { phase } = useBlindSequence();
  switch (phase) {
    case 'hub':
      return <HubPhase />;
    case 'settings':
    case 'generating':
      return <SettingsPhase />;
    case 'dictation':
      return <DictationPhase />;
    case 'observing':
      return <ObservingPhase />;
    case 'reconstruction':
      return <ReconstructionPhase />;
    case 'recitation':
      return <RecitationPhase />;
    case 'results':
      return <ResultsPhase />;
    default:
      return <HubPhase />;
  }
}

function ScreenShell({
  title,
  children,
  onBack,
}: {
  title: string;
  children: React.ReactNode;
  onBack?: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom;

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingTop: topPad + 6,
          paddingBottom: bottomPad + 6,
        },
      ]}
    >
      <View style={styles.header}>
        <Pressable
          onPress={onBack ?? (() => router.back())}
          hitSlop={10}
          style={({ pressed }) => [
            styles.iconBtn,
            { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Ionicons name="chevron-back" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
          {title}
        </Text>
        <SoundToggle />
      </View>
      {children}
    </View>
  );
}

function HubPhase() {
  const colors = useColors();
  const { selectSubmode } = useBlindSequence();
  const router = useRouter();

  return (
    <ScreenShell title="Séquences à l’aveugle" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.settingsBody}>
        <Text style={[styles.lead, { color: colors.mutedForeground }]}>
          Choisis un exercice. Les séquences sont générées par Stockfish (1 à 20 coups complets).
        </Text>

        <Pressable
          onPress={() => selectSubmode('listen-reconstruct')}
          style={({ pressed }) => [
            styles.modeCard,
            { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Ionicons name="ear-outline" size={28} color={colors.primary} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.modeTitle, { color: colors.foreground }]}>
              Écouter puis reconstruire
            </Text>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Dictée orale, puis reproduction sur l’échiquier.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
        </Pressable>

        <Pressable
          onPress={() => selectSubmode('watch-recite')}
          style={({ pressed }) => [
            styles.modeCard,
            { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Ionicons name="eye-outline" size={28} color={colors.primary} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.modeTitle, { color: colors.foreground }]}>
              Regarder puis réciter
            </Text>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Observation visuelle silencieuse, puis récitation à voix haute.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
        </Pressable>
      </ScrollView>
    </ScreenShell>
  );
}

function SettingsPhase() {
  const colors = useColors();
  const {
    submode,
    orientation,
    fullMoves,
    pace,
    dictationPace,
    setOrientation,
    setFullMoves,
    setPace,
    setDictationPace,
    startSession,
    isGenerating,
    generateError,
    backToHub,
  } = useBlindSequence();

  const title =
    submode === 'watch-recite' ? 'Regarder puis réciter' : 'Écouter puis reconstruire';

  return (
    <ScreenShell title={title} onBack={backToHub}>
      <ScrollView contentContainerStyle={styles.settingsBody}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          Orientation de l’échiquier
        </Text>
        <View style={styles.row}>
          {(
            [
              { id: 'w' as BlindOrientation, label: '♔ Blancs en bas' },
              { id: 'b' as BlindOrientation, label: '♚ Noirs en bas' },
            ] as const
          ).map((opt) => {
            const active = orientation === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => setOrientation(opt.id)}
                style={[
                  styles.choice,
                  {
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={{
                    fontFamily: 'Inter_600SemiBold',
                    fontSize: 13,
                    color: active ? colors.primaryForeground : colors.foreground,
                    textAlign: 'center',
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Les Blancs jouent toujours en premier. 1 coup complet = 1 coup Blanc + 1 coup Noir.
        </Text>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          Coups complets (1–20)
        </Text>
        <View style={styles.chipRow}>
          {FULL_MOVE_OPTIONS.map((n) => {
            const active = fullMoves === n;
            return (
              <Pressable
                key={n}
                onPress={() => setFullMoves(n)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={{
                    fontFamily: 'Inter_600SemiBold',
                    fontSize: 12,
                    color: active ? colors.primaryForeground : colors.foreground,
                  }}
                >
                  {n}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          {fullMoves} coups complets = {halfMoveCount(fullMoves)} demi-coups
          {fullMoves === 20 ? ' (maximum)' : ''}
        </Text>

        {submode === 'watch-recite' && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              Vitesse d’observation
            </Text>
            <View style={styles.row}>
              {(
                [
                  { id: 'slow' as ObservationPace, label: 'Lent' },
                  { id: 'normal' as ObservationPace, label: 'Normal' },
                  { id: 'fast' as ObservationPace, label: 'Rapide' },
                ] as const
              ).map((opt) => {
                const active = pace === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => setPace(opt.id)}
                    style={[
                      styles.choice,
                      {
                        backgroundColor: active ? colors.primary : colors.card,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontFamily: 'Inter_600SemiBold',
                        fontSize: 13,
                        color: active ? colors.primaryForeground : colors.foreground,
                      }}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {submode === 'listen-reconstruct' && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              Vitesse de dictée
            </Text>
            <View style={styles.row}>
              {(
                [
                  { id: 'slow' as DictationPace, label: 'Lent' },
                  { id: 'medium' as DictationPace, label: 'Moyen' },
                  { id: 'fast' as DictationPace, label: 'Rapide' },
                ] as const
              ).map((opt) => {
                const active = dictationPace === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => setDictationPace(opt.id)}
                    style={[
                      styles.choice,
                      {
                        backgroundColor: active ? colors.primary : colors.card,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontFamily: 'Inter_600SemiBold',
                        fontSize: 13,
                        color: active ? colors.primaryForeground : colors.foreground,
                      }}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {!!generateError && (
          <Text style={{ color: colors.destructive, fontFamily: 'Inter_400Regular', fontSize: 13 }}>
            {generateError}
          </Text>
        )}

        <Pressable
          onPress={() => startSession()}
          disabled={isGenerating}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: colors.primary, opacity: isGenerating || pressed ? 0.7 : 1 },
          ]}
        >
          {isGenerating ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <>
              <Ionicons name="play" size={20} color={colors.primaryForeground} />
              <Text style={[styles.ctaLabel, { color: colors.primaryForeground }]}>
                Générer la séquence
              </Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </ScreenShell>
  );
}

function DictationPhase() {
  const colors = useColors();
  const { fullMoves, isSpeaking, replayDictation, startReconstruction, backToSettings } =
    useBlindSequence();

  return (
    <ScreenShell title="Dictée" onBack={backToSettings}>
      <View style={styles.phaseBody}>
        <View style={[styles.hiddenCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="ear-outline" size={48} color={colors.mutedForeground} />
          <Text style={[styles.hiddenTitle, { color: colors.foreground }]}>Échiquier masqué</Text>
          <Text style={[styles.hint, { color: colors.mutedForeground, textAlign: 'center' }]}>
            Écoute les {halfMoveCount(fullMoves)} demi-coups. Aucune notation affichée.
          </Text>
          {isSpeaking && (
            <Text style={{ color: colors.primary, fontFamily: 'Inter_500Medium', marginTop: 8 }}>
              Dictée en cours…
            </Text>
          )}
        </View>
        <Pressable
          onPress={replayDictation}
          style={({ pressed }) => [
            styles.secondaryCta,
            { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="volume-medium-outline" size={18} color={colors.foreground} />
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
            Rejouer la séquence
          </Text>
        </Pressable>
        <Pressable
          onPress={startReconstruction}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: colors.primary, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Ionicons name="grid-outline" size={18} color={colors.primaryForeground} />
          <Text style={[styles.ctaLabel, { color: colors.primaryForeground }]}>
            Commencer la reconstruction
          </Text>
        </Pressable>
      </View>
    </ScreenShell>
  );
}

function ObservingPhase() {
  const colors = useColors();
  const {
    board,
    lastMove,
    orientation,
    sequence,
    observationIndex,
    isReplaying,
    startRecitation,
    backToSettings,
  } = useBlindSequence();

  const observationDone = !isReplaying && observationIndex >= sequence.length && sequence.length > 0;

  return (
    <ScreenShell title="Observation" onBack={backToSettings}>
      <View style={styles.phaseBody}>
        <Text style={[styles.hint, { color: colors.mutedForeground, textAlign: 'center' }]}>
          Regarde la séquence — aucune annonce orale.
        </Text>
        <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', textAlign: 'center' }}>
          Coup {observationIndex} / {sequence.length}
        </Text>
        <View style={{ alignItems: 'center' }}>
          <ChessBoard
            board={board}
            lastMove={lastMove}
            isFlipped={orientation === 'b'}
          />
        </View>
        {observationDone && (
          <>
            <Text style={[styles.hint, { color: colors.mutedForeground, textAlign: 'center' }]}>
              Séquence terminée. Mémorise la position finale, puis commence la récitation.
            </Text>
            <Pressable
              onPress={startRecitation}
              style={({ pressed }) => [
                styles.cta,
                { backgroundColor: colors.primary, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Ionicons name="mic-outline" size={18} color={colors.primaryForeground} />
              <Text style={[styles.ctaLabel, { color: colors.primaryForeground }]}>
                Passer à la récitation
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </ScreenShell>
  );
}

function ReconstructionPhase() {
  const colors = useColors();
  const {
    board,
    lastMove,
    orientation,
    sequence,
    expectedIndex,
    lastFeedback,
    revealedHint,
    getLegalDestinations,
    attemptMove,
    useHelp,
    backToSettings,
  } = useBlindSequence();
  const { soundEnabled } = useAudioSettings();

  const [selected, setSelected] = useState<string | null>(null);
  const [legalDests, setLegalDests] = useState<string[]>([]);

  useEffect(() => {
    setSelected(null);
    setLegalDests([]);
  }, [expectedIndex]);

  const onSquarePress = useCallback(
    (square: string) => {
      if (selected === null) {
        const dests = getLegalDestinations(square);
        if (dests.length > 0) {
          setSelected(square);
          setLegalDests(dests);
        }
      } else if (square === selected) {
        setSelected(null);
        setLegalDests([]);
      } else if (legalDests.includes(square)) {
        const ok = attemptMove(selected, square);
        if (!ok && soundEnabled) {
          /* TTS already handled in context when unmuted */
        }
        setSelected(null);
        setLegalDests([]);
      } else {
        const dests = getLegalDestinations(square);
        if (dests.length > 0) {
          setSelected(square);
          setLegalDests(dests);
        } else {
          setSelected(null);
          setLegalDests([]);
        }
      }
    },
    [selected, legalDests, getLegalDestinations, attemptMove, soundEnabled],
  );

  return (
    <ScreenShell title="Reconstruction" onBack={backToSettings}>
      <View style={styles.phaseBody}>
        <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12 }}>
            Coup {Math.min(expectedIndex + 1, sequence.length)} / {sequence.length}
          </Text>
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium', fontSize: 14 }}>
            {lastFeedback ?? 'Reproduis le prochain coup.'}
          </Text>
          {!!revealedHint && (
            <Text style={{ color: colors.primary, fontFamily: 'Inter_500Medium', fontSize: 13 }}>
              {revealedHint}
            </Text>
          )}
        </View>
        <View style={{ alignItems: 'center' }}>
          <ChessBoard
            board={board}
            lastMove={lastMove}
            isFlipped={orientation === 'b'}
            selectedSquare={selected}
            legalDots={legalDests}
            onSquarePress={onSquarePress}
          />
        </View>
        <Pressable
          onPress={useHelp}
          style={({ pressed }) => [
            styles.secondaryCta,
            { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="help-circle-outline" size={18} color={colors.foreground} />
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
            Aide — révéler le coup
          </Text>
        </Pressable>
      </View>
    </ScreenShell>
  );
}

function RecitationPhase() {
  const colors = useColors();
  const {
    sequence,
    expectedIndex,
    lastFeedback,
    revealedHint,
    isSpeaking,
    attemptSpoken,
    useHelp,
    skipExpectedMove,
    backToSettings,
  } = useBlindSequence();

  const {
    micActive,
    isListening,
    status: micStatus,
    toggleMic,
  } = useSpeechInput({
    isSpeaking,
    onTranscript: (text) => {
      attemptSpoken(text);
    },
  });

  return (
    <ScreenShell title="Récitation" onBack={backToSettings}>
      <View style={styles.phaseBody}>
        <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12 }}>
            Coup {Math.min(expectedIndex + 1, sequence.length)} / {sequence.length}
          </Text>
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium', fontSize: 14 }}>
            {lastFeedback ?? 'Dis le prochain coup à voix haute.'}
          </Text>
          {!!revealedHint && (
            <Text style={{ color: colors.primary, fontFamily: 'Inter_500Medium', fontSize: 13 }}>
              {revealedHint}
            </Text>
          )}
        </View>

        <View style={[styles.hiddenCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="mic-outline" size={40} color={colors.mutedForeground} />
          <Text style={[styles.hint, { color: colors.mutedForeground, textAlign: 'center' }]}>
            Ex. « e4 », « Cavalier f3 », « petit roque »
          </Text>
        </View>

        <ChessAnswerInput
          onSubmit={(text) => attemptSpoken(text)}
          enabled
          persistFocus
          placeholder="Ex. e4, Cf3, petit roque…"
        />

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            toggleMic();
          }}
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor: isListening ? '#C0392B' : micActive ? '#D4880A' : colors.primary,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Ionicons name={isListening ? 'mic' : 'mic-outline'} size={20} color="#fff" />
          <Text style={[styles.ctaLabel, { color: '#fff' }]}>
            {isListening ? "J'écoute…" : micActive ? 'Micro actif' : 'Activer le micro'}
          </Text>
        </Pressable>
        {!!micStatus.message && (
          <Text style={{ color: '#F5A623', fontSize: 12, textAlign: 'center' }}>{micStatus.message}</Text>
        )}

        <Pressable
          onPress={skipExpectedMove}
          style={({ pressed }) => [
            styles.secondaryCta,
            { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="play-skip-forward-outline" size={18} color={colors.foreground} />
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
            Passer ce coup
          </Text>
        </Pressable>

        <Pressable
          onPress={useHelp}
          style={({ pressed }) => [
            styles.secondaryCta,
            { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="help-circle-outline" size={18} color={colors.foreground} />
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
            Aide — révéler le coup
          </Text>
        </Pressable>
      </View>
    </ScreenShell>
  );
}

function ResultsPhase() {
  const colors = useColors();
  const {
    score,
    submode,
    board,
    lastMove,
    orientation,
    sequence,
    observationIndex,
    isReplaying,
    retrySameSequence,
    generateNewSequence,
    reviewSequenceVisually,
    backToSettings,
    backToHub,
    isGenerating,
  } = useBlindSequence();
  const router = useRouter();

  if (!score) {
    return (
      <ScreenShell title="Résultat" onBack={backToSettings}>
        <ActivityIndicator color={colors.primary} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Résultat" onBack={() => router.push('/' as Href)}>
      <ScrollView contentContainerStyle={styles.settingsBody}>
        <Text style={[styles.scoreHero, { color: colors.primary }]}>
          Précision au premier essai : {score.accuracyPercent} %
        </Text>
        <Text style={[styles.lead, { color: colors.foreground }]}>
          Coups corrects au premier essai : {score.correctOnFirstAttempt} / {score.totalHalfMoves}
        </Text>

        {(submode === 'watch-recite' || submode === 'listen-reconstruct') && (
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12 }}>
              {isReplaying
                ? `Relecture ${observationIndex} / ${sequence.length}`
                : 'Position finale'}
            </Text>
            <ChessBoard
              board={board}
              lastMove={lastMove}
              isFlipped={orientation === 'b'}
              selectedSquare={null}
              legalDots={[]}
              onSquarePress={() => {}}
            />
          </View>
        )}

        <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {submode === 'listen-reconstruct' ? (
            <>
              <StatRow label="Erreurs de pièce" value={score.wrongPiece} colors={colors} />
              <StatRow label="Erreurs de destination" value={score.wrongDestination} colors={colors} />
              <StatRow label="Erreurs d’ordre" value={score.wrongOrder} colors={colors} />
              <StatRow label="Aides utilisées" value={score.helpsUsed} colors={colors} />
            </>
          ) : (
            <>
              <StatRow label="Erreurs de coup" value={score.wrongMove} colors={colors} />
              <StatRow label="Erreurs d’ordre" value={score.wrongOrder} colors={colors} />
              <StatRow
                label="Erreurs de reconnaissance non comptabilisées"
                value={score.recognitionFailures}
                colors={colors}
              />
              <StatRow label="Aides utilisées" value={score.helpsUsed} colors={colors} />
            </>
          )}
        </View>

        <Pressable
          onPress={retrySameSequence}
          disabled={isReplaying}
          style={({ pressed }) => [
            styles.secondaryCta,
            {
              borderColor: colors.border,
              backgroundColor: colors.card,
              opacity: isReplaying || pressed ? 0.55 : 1,
            },
          ]}
        >
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
            Refaire la même séquence
          </Text>
        </Pressable>

        {submode === 'watch-recite' && (
          <Pressable
            onPress={reviewSequenceVisually}
            disabled={isReplaying}
            style={({ pressed }) => [
              styles.secondaryCta,
              {
                borderColor: colors.border,
                backgroundColor: colors.card,
                opacity: isReplaying || pressed ? 0.55 : 1,
              },
            ]}
          >
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
              Revoir la séquence
            </Text>
          </Pressable>
        )}

        <Pressable
          onPress={() => generateNewSequence()}
          disabled={isGenerating || isReplaying}
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor: colors.primary,
              opacity: isGenerating || isReplaying || pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text style={[styles.ctaLabel, { color: colors.primaryForeground }]}>
            Nouvelle séquence
          </Text>
        </Pressable>

        <Pressable
          onPress={backToHub}
          disabled={isReplaying}
          style={({ pressed }) => [
            styles.secondaryCta,
            {
              borderColor: colors.border,
              backgroundColor: colors.card,
              opacity: isReplaying || pressed ? 0.55 : 1,
            },
          ]}
        >
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
            Menu des exercices
          </Text>
        </Pressable>
      </ScrollView>
    </ScreenShell>
  );
}

function StatRow({
  label,
  value,
  colors,
}: {
  label: string;
  value: number;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.statRow}>
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 13, flex: 1 }}>
        {label}
      </Text>
      <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 14, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 17, fontFamily: 'Inter_700Bold', flex: 1 },
  settingsBody: { gap: 14, paddingBottom: 28 },
  phaseBody: { flex: 1, gap: 12 },
  lead: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: { flexDirection: 'row', gap: 8 },
  choice: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  ctaLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  secondaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  modeTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  hiddenCard: {
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 20,
  },
  hiddenTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  listCard: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 4 },
  statusCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 2,
  },
  scoreHero: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    marginTop: 8,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
});
