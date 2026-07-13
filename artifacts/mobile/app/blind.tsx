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
import { useColors } from '@/hooks/useColors';
import { ChessBoard } from '@/components/ChessBoard';
import {
  BlindSequenceProvider,
  useBlindSequence,
} from '@/contexts/BlindSequenceContext';
import { halfMoveCount } from '@/lib/blind';
import type { BlindOrientation } from '@/lib/blind';

const FULL_MOVE_OPTIONS = [2, 3, 4, 5, 6, 8];

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
    case 'settings':
    case 'generating':
      return <SettingsPhase />;
    case 'dictation':
      return <DictationPhase />;
    case 'reconstruction':
      return <ReconstructionPhase />;
    case 'results':
      return <ResultsPhase />;
    default:
      return <SettingsPhase />;
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
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function SettingsPhase() {
  const colors = useColors();
  const {
    orientation,
    fullMoves,
    setOrientation,
    setFullMoves,
    startSession,
    isGenerating,
    generateError,
  } = useBlindSequence();
  const router = useRouter();

  return (
    <ScreenShell title="Séquences à l’aveugle" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.settingsBody}>
        <Text style={[styles.lead, { color: colors.mutedForeground }]}>
          Mémorise une séquence dictée, puis reconstruis-la sur l’échiquier.
        </Text>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          Orientation de l’échiquier
        </Text>
        <View style={styles.row}>
          {([
            { id: 'w' as BlindOrientation, label: '♔ Blancs en bas' },
            { id: 'b' as BlindOrientation, label: '♚ Noirs en bas' },
          ]).map((opt) => {
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
          Les Blancs jouent toujours en premier. L’orientation ne change que la vue.
        </Text>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          Nombre de coups complets
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
          {fullMoves} coups complets = {fullMoves} Blancs + {fullMoves} Noirs ={' '}
          {halfMoveCount(fullMoves)} demi-coups
        </Text>

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
            {
              backgroundColor: colors.primary,
              opacity: isGenerating || pressed ? 0.7 : 1,
            },
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
        {isGenerating && (
          <Text style={[styles.hint, { color: colors.mutedForeground, textAlign: 'center' }]}>
            Stockfish prépare une ligne d’ouverture…
          </Text>
        )}
      </ScrollView>
    </ScreenShell>
  );
}

function DictationPhase() {
  const colors = useColors();
  const {
    fullMoves,
    isSpeaking,
    replayDictation,
    startReconstruction,
    backToSettings,
  } = useBlindSequence();

  return (
    <ScreenShell title="Dictée" onBack={backToSettings}>
      <View style={styles.phaseBody}>
        <View style={[styles.hiddenCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="ear-outline" size={48} color={colors.mutedForeground} />
          <Text style={[styles.hiddenTitle, { color: colors.foreground }]}>
            Échiquier masqué
          </Text>
          <Text style={[styles.hint, { color: colors.mutedForeground, textAlign: 'center' }]}>
            Écoute les {halfMoveCount(fullMoves)} demi-coups ({fullMoves} coups complets).
            Aucune notation n’est affichée — mémorise à l’oreille.
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
        attemptMove(selected, square);
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
    [selected, legalDests, getLegalDestinations, attemptMove],
  );

  const expected = sequence[expectedIndex];
  const progress = `${Math.min(expectedIndex + 1, sequence.length)} / ${sequence.length}`;

  return (
    <ScreenShell title="Reconstruction" onBack={backToSettings}>
      <View style={styles.phaseBody}>
        <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12 }}>
            Coup {progress}
          </Text>
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium', fontSize: 14 }}>
            {lastFeedback ?? 'Reproduis le prochain coup annoncé.'}
          </Text>
          {!!revealedHint && (
            <Text style={{ color: colors.primary, fontFamily: 'Inter_500Medium', fontSize: 13, marginTop: 4 }}>
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

        {expected && (
          <Text style={[styles.hint, { color: colors.mutedForeground, textAlign: 'center' }]}>
            À toi de jouer ({expected.color === 'w' ? 'Blancs' : 'Noirs'})
          </Text>
        )}
      </View>
    </ScreenShell>
  );
}

function ResultsPhase() {
  const colors = useColors();
  const {
    score,
    retrySameSequence,
    generateNewSequence,
    backToSettings,
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

        <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <StatRow label="Erreurs de pièce" value={score.wrongPiece} colors={colors} />
          <StatRow label="Erreurs de destination" value={score.wrongDestination} colors={colors} />
          <StatRow label="Erreurs d’ordre" value={score.wrongOrder} colors={colors} />
          <StatRow label="Aides utilisées" value={score.helpsUsed} colors={colors} />
        </View>

        <Pressable
          onPress={retrySameSequence}
          style={({ pressed }) => [
            styles.secondaryCta,
            { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="refresh-outline" size={18} color={colors.foreground} />
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
            Refaire la même séquence
          </Text>
        </Pressable>

        <Pressable
          onPress={() => generateNewSequence()}
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
              <Ionicons name="sparkles-outline" size={18} color={colors.primaryForeground} />
              <Text style={[styles.ctaLabel, { color: colors.primaryForeground }]}>
                Nouvelle séquence
              </Text>
            </>
          )}
        </Pressable>

        <Pressable
          onPress={backToSettings}
          style={({ pressed }) => [
            styles.secondaryCta,
            { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="options-outline" size={18} color={colors.foreground} />
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
            Réglages
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/' as Href)}
          style={({ pressed }) => [
            styles.secondaryCta,
            { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="home-outline" size={18} color={colors.foreground} />
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
            Menu principal
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
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 13 }}>
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
  title: { fontSize: 18, fontFamily: 'Inter_700Bold', flex: 1 },
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    width: 44,
    height: 40,
    borderRadius: 10,
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
  hiddenCard: {
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 20,
  },
  hiddenTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  listCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  statusCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 2,
  },
  scoreHero: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    marginTop: 8,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
});
