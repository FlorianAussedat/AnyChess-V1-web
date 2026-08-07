import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { ModeScreenShell } from '@/components/ModeScreenShell';
import { ChessBoard } from '@/components/ChessBoard';
import { PuzzleStatRow } from '@/components/puzzles/PuzzleStatRow';
import { puzzleStyles } from '@/components/puzzles/puzzleStyles';
import { usePuzzle } from '@/contexts/PuzzleContext';
import { formatHelpsUsed } from '@/lib/puzzles';

export function PuzzleResultsPhase() {
  const colors = useColors();
  const {
    stats,
    solutionLine,
    displayBoard,
    lastMove,
    orientation,
    isReplaying,
    currentStreak,
    nextPuzzle,
    retry,
    revealSolution,
    backToHub,
  } = usePuzzle();
  const router = useRouter();

  return (
    <ModeScreenShell title="Résultat" onBack={() => router.push('/' as Href)}>
      <ScrollView contentContainerStyle={puzzleStyles.body}>
        <Text style={[puzzleStyles.scoreHero, { color: colors.primary }]}>
          {stats?.solutionRequested && !stats.solved ? 'Solution affichée' : 'Problème résolu'}
        </Text>
        <Text style={[puzzleStyles.meta, { color: colors.mutedForeground, textAlign: 'center' }]}>
          Série : {currentStreak}
        </Text>
        {!!stats && (
          <View style={[puzzleStyles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <PuzzleStatRow
              label="Précision au premier essai"
              value={`${stats.accuracyPercent} %`}
            />
            <PuzzleStatRow label="Erreurs de coup" value={String(stats.wrongChessMoves)} />
            <PuzzleStatRow
              label="Erreurs de reconnaissance"
              value={String(stats.recognitionFailures)}
            />
            <PuzzleStatRow
              label="Aides utilisées"
              value={formatHelpsUsed(stats.helps)}
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
            board={displayBoard}
            lastMove={lastMove}
            isFlipped={orientation === 'b'}
            onSquarePress={() => {}}
          />
        </View>

        <Pressable
          disabled={isReplaying}
          onPress={() => nextPuzzle()}
          style={({ pressed }) => [
            puzzleStyles.cta,
            { backgroundColor: colors.primary, opacity: isReplaying || pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[puzzleStyles.ctaLabel, { color: colors.primaryForeground }]}>
            Problème suivant
          </Text>
        </Pressable>

        <Pressable
          disabled={isReplaying}
          onPress={retry}
          style={({ pressed }) => [
            puzzleStyles.secondaryCta,
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
            puzzleStyles.secondaryCta,
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
            puzzleStyles.secondaryCta,
            { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
            Menu des problèmes
          </Text>
        </Pressable>
      </ScrollView>
    </ModeScreenShell>
  );
}
