import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { ModeScreenShell } from '@/components/ModeScreenShell';
import { ChessBoard } from '@/components/ChessBoard';
import { PuzzleStatRow } from '@/components/puzzles/PuzzleStatRow';
import { puzzleStyles } from '@/components/puzzles/puzzleStyles';
import { usePuzzle } from '@/contexts/PuzzleContext';
import { useBoardSize } from '@/hooks/useBoardSize';
import {
  countPuzzleIndices,
  puzzleResultState,
  puzzleResultTitle,
} from '@/lib/puzzles';

export function PuzzleResultsPhase() {
  const colors = useColors();
  const boardSize = useBoardSize('wide');
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

  const state = stats ? puzzleResultState(stats) : 'unsolved';
  const title = puzzleResultTitle(state);
  const indices = stats
    ? countPuzzleIndices(stats.helps, stats.nextMoveUses)
    : 0;

  return (
    <ModeScreenShell title="Résultat" onBack={() => router.push('/' as Href)}>
      <ScrollView contentContainerStyle={puzzleStyles.body}>
        <Text
          style={[
            puzzleStyles.scoreHero,
            { color: state === 'unsolved' ? colors.mutedForeground : colors.primary },
          ]}
          testID="puzzle-result-title"
        >
          {title}
        </Text>

        {state === 'unsolved' && (
          <Text
            style={[
              puzzleStyles.meta,
              { color: colors.mutedForeground, textAlign: 'center' },
            ]}
            testID="puzzle-solution-consulted"
          >
            Solution consultée
          </Text>
        )}

        <Text
          style={[
            puzzleStyles.meta,
            { color: colors.mutedForeground, textAlign: 'center' },
          ]}
        >
          Série : {currentStreak}
        </Text>

        {!!stats && (
          <View
            style={[
              puzzleStyles.listCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {state !== 'unsolved' && (
              <>
                <PuzzleStatRow
                  label="Erreurs de coup"
                  value={String(stats.wrongChessMoves)}
                />
                <PuzzleStatRow
                  label="Erreurs de reconnaissance"
                  value={String(stats.recognitionFailures)}
                />
              </>
            )}
            <PuzzleStatRow label="Indices utilisés" value={String(indices)} />
          </View>
        )}

        {!!solutionLine && (
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 13 }}>
            {solutionLine}
          </Text>
        )}

        <View
          style={{
            alignItems: 'center',
            alignSelf: 'center',
            width: boardSize,
          }}
        >
          <ChessBoard
            board={displayBoard}
            lastMove={lastMove}
            isFlipped={orientation === 'b'}
            onSquarePress={() => {}}
            sizeMode="wide"
            size={boardSize}
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
