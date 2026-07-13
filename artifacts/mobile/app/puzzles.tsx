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
import { SoundToggle } from '@/components/SoundToggle';
import { HiddenBoardPlaceholder } from '@/components/HiddenBoardPlaceholder';
import { PuzzleProvider, usePuzzle } from '@/contexts/PuzzleContext';
import { useSpeechInput } from '@/services/SpeechRecognitionService';
import { useAudioSettings } from '@/hooks/useAudioSettings';
import { puzzleRepository } from '@/lib/puzzles';

export default function PuzzlesRoute() {
  return (
    <PuzzleProvider>
      <PuzzlesScreen />
    </PuzzleProvider>
  );
}

function PuzzlesScreen() {
  const { phase } = usePuzzle();
  switch (phase) {
    case 'hub':
      return <HubPhase />;
    case 'playing':
    case 'solution-replay':
      return <PlayingPhase />;
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
  const router = useRouter();
  const {
    selectSubmode,
    setFilters,
    filters,
    startPuzzle,
    loadError,
    submode,
  } = usePuzzle();
  const [starting, setStarting] = useState(false);
  const packCount = puzzleRepository.count();
  const manifest = puzzleRepository.getManifest();

  const onStart = async (mode: 'visual' | 'blind') => {
    selectSubmode(mode);
    setStarting(true);
    try {
      await startPuzzle();
    } finally {
      setStarting(false);
    }
  };

  return (
    <ScreenShell title="Problèmes / Visualisation" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.lead, { color: colors.mutedForeground }]}>
          Résous des problèmes Lichess hors-ligne (cote puzzle Lichess{' '}
          {manifest.ratingMin}–{manifest.ratingMax}). Pack local : {packCount} problèmes.
        </Text>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          Difficulté (cote puzzle Lichess)
        </Text>
        <View style={styles.row}>
          {(
            [
              { min: 1600, max: 1800, label: '1600–1800' },
              { min: 1800, max: 2000, label: '1800–2000' },
              { min: 2000, max: 2200, label: '2000–2200' },
              { min: 1600, max: 2200, label: 'Tout' },
            ] as const
          ).map((opt) => {
            const active = filters.ratingMin === opt.min && filters.ratingMax === opt.max;
            return (
              <Pressable
                key={opt.label}
                onPress={() => setFilters({ ratingMin: opt.min, ratingMax: opt.max })}
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
                    fontSize: 12,
                    fontFamily: 'Inter_600SemiBold',
                    color: active ? colors.primaryForeground : colors.foreground,
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          disabled={starting}
          onPress={() => onStart('visual')}
          style={({ pressed }) => [
            styles.modeCard,
            { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed || starting ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="eye-outline" size={28} color={colors.primary} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.modeTitle, { color: colors.foreground }]}>
              Résolution visuelle
            </Text>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Échiquier visible — voix ou doigt.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
        </Pressable>

        <Pressable
          disabled={starting}
          onPress={() => onStart('blind')}
          style={({ pressed }) => [
            styles.modeCard,
            { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed || starting ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="ear-outline" size={28} color={colors.primary} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.modeTitle, { color: colors.foreground }]}>
              Résolution à l’aveugle
            </Text>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Position dictée — réponse à voix haute.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
        </Pressable>

        {starting && <ActivityIndicator color={colors.primary} />}
        {!!loadError && (
          <Text style={{ color: colors.destructive, fontFamily: 'Inter_400Regular' }}>{loadError}</Text>
        )}
        {!!submode && !starting && !!loadError && (
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            Ajuste les filtres ou réessaie.
          </Text>
        )}
      </ScrollView>
    </ScreenShell>
  );
}

function PlayingPhase() {
  const colors = useColors();
  const { soundEnabled } = useAudioSettings();
  const {
    phase,
    submode,
    puzzle,
    board,
    lastMove,
    orientation,
    boardVisible,
    isReplaying,
    isSpeaking,
    lastFeedback,
    solutionLine,
    positionNarration,
    sideToMove,
    getLegalDestinations,
    attemptBoardMove,
    applySpokenMove,
    revealSolution,
    repeatPosition,
    backToHub,
  } = usePuzzle();

  const [selected, setSelected] = useState<string | null>(null);
  const [legalDests, setLegalDests] = useState<string[]>([]);

  const {
    micActive,
    isListening,
    status: micStatus,
    toggleMic,
  } = useSpeechInput({
    isSpeaking,
    enabled: !isReplaying,
    forceOff: isReplaying,
    onTranscript: (text) => {
      const r = applySpokenMove(text);
      if (r === 'correct' || r === 'complete') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (r === 'wrong-legal' || r === 'illegal') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
  });

  useEffect(() => {
    setSelected(null);
    setLegalDests([]);
  }, [puzzle?.id, lastMove?.from, lastMove?.to]);

  const onSquarePress = useCallback(
    (square: string) => {
      if (isReplaying || submode !== 'visual' || !boardVisible) return;
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
        const r = attemptBoardMove(selected, square);
        if (r === 'correct' || r === 'complete') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (r === 'wrong-legal' || r === 'illegal') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
    [
      isReplaying,
      submode,
      boardVisible,
      selected,
      legalDests,
      getLegalDestinations,
      attemptBoardMove,
    ],
  );

  const title =
    phase === 'solution-replay'
      ? 'Solution'
      : submode === 'blind'
        ? 'À l’aveugle'
        : 'Visuel';

  return (
    <ScreenShell title={title} onBack={backToHub}>
      <ScrollView contentContainerStyle={styles.body}>
        {!!puzzle && (
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>
            {puzzle.id} · cote {puzzle.rating} (Lichess) ·{' '}
            {sideToMove === 'w' ? 'Trait aux Blancs' : 'Trait aux Noirs'}
          </Text>
        )}

        <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium', fontSize: 14 }}>
            {lastFeedback ?? (isReplaying ? 'Relecture…' : 'À toi de trouver le coup.')}
          </Text>
          {!!solutionLine && (
            <Text style={{ color: colors.primary, fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 6 }}>
              {solutionLine}
            </Text>
          )}
        </View>

        {boardVisible ? (
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
        ) : (
          <HiddenBoardPlaceholder />
        )}

        {submode === 'blind' && !!positionNarration && !boardVisible && (
          <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 }}>
              {positionNarration}
            </Text>
          </View>
        )}

        {!isReplaying && (
          <>
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

            {submode === 'blind' && (
              <Pressable
                onPress={repeatPosition}
                style={({ pressed }) => [
                  styles.secondaryCta,
                  { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Ionicons name="volume-medium-outline" size={18} color={colors.foreground} />
                <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
                  Répéter la position
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={revealSolution}
              style={({ pressed }) => [
                styles.secondaryCta,
                { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Ionicons name="bulb-outline" size={18} color={colors.foreground} />
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
                Solution
              </Text>
            </Pressable>
          </>
        )}

        {!soundEnabled && (
          <Text style={[styles.hint, { color: colors.mutedForeground, textAlign: 'center' }]}>
            Son coupé — relecture visuelle uniquement.
          </Text>
        )}
      </ScrollView>
    </ScreenShell>
  );
}

function ResultsPhase() {
  const colors = useColors();
  const {
    stats,
    solutionLine,
    board,
    lastMove,
    orientation,
    isReplaying,
    nextPuzzle,
    retry,
    revealSolution,
    backToHub,
  } = usePuzzle();
  const router = useRouter();

  return (
    <ScreenShell title="Résultat" onBack={() => router.push('/' as Href)}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.scoreHero, { color: colors.primary }]}>
          {stats?.solutionRequested && !stats.solved ? 'Solution affichée' : 'Problème résolu'}
        </Text>
        {!!stats && (
          <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <StatRow
              label="Précision au premier essai"
              value={`${stats.accuracyPercent} %`}
              colors={colors}
            />
            <StatRow label="Erreurs de coup" value={String(stats.wrongChessMoves)} colors={colors} />
            <StatRow
              label="Erreurs de reconnaissance"
              value={String(stats.recognitionFailures)}
              colors={colors}
            />
            <StatRow
              label="Solution utilisée"
              value={stats.solutionRequested ? 'oui' : 'non'}
              colors={colors}
            />
          </View>
        )}

        {!!solutionLine && (
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 13 }}>
            {solutionLine}
          </Text>
        )}

        <View style={{ alignItems: 'center' }}>
          <ChessBoard
            board={board}
            lastMove={lastMove}
            isFlipped={orientation === 'b'}
            onSquarePress={() => {}}
          />
        </View>

        <Pressable
          disabled={isReplaying}
          onPress={() => nextPuzzle()}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: colors.primary, opacity: isReplaying || pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.ctaLabel, { color: colors.primaryForeground }]}>
            Problème suivant
          </Text>
        </Pressable>

        <Pressable
          disabled={isReplaying}
          onPress={retry}
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
            Refaire ce problème
          </Text>
        </Pressable>

        <Pressable
          disabled={isReplaying}
          onPress={revealSolution}
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
            Rejouer la solution
          </Text>
        </Pressable>

        <Pressable
          onPress={backToHub}
          style={({ pressed }) => [
            styles.secondaryCta,
            { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
            Menu des problèmes
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
  value: string;
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
  body: { gap: 14, paddingBottom: 28 },
  lead: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
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
  hint: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  meta: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  statusCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 2,
  },
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
  listCard: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 4 },
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
