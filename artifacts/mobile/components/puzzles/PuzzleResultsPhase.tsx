import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { ModeScreenShell } from '@/components/ModeScreenShell';
import { ChessBoard } from '@/components/ChessBoard';
import { PuzzleStatRow } from '@/components/puzzles/PuzzleStatRow';
import { puzzleStyles } from '@/components/puzzles/puzzleStyles';
import { usePuzzle } from '@/contexts/PuzzleContext';
import { useBoardSize } from '@/hooks/useBoardSize';
import { usePreferences } from '@/hooks/usePreferences';
import { formatSanLineForDisplay } from '@/lib/chess/notation';
import {
  countPuzzleIndices,
  puzzleResultState,
} from '@/lib/puzzles';

export function PuzzleResultsPhase() {
  const colors = useColors();
  const { t } = useTranslation();
  const boardSize = useBoardSize('wide');
  const { chessNotation } = usePreferences();
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
  const title =
    state === 'solved'
      ? t('puzzle.solved')
      : state === 'solved-with-help'
        ? t('puzzle.solvedWithHelp')
        : t('puzzle.unsolved');
  const indices = stats
    ? countPuzzleIndices(stats.helps, stats.nextMoveUses)
    : 0;

  return (
    <ModeScreenShell title={t('puzzle.result')} onBack={() => router.push('/' as Href)}>
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
            {t('puzzle.solutionConsulted')}
          </Text>
        )}

        <Text
          style={[
            puzzleStyles.meta,
            { color: colors.mutedForeground, textAlign: 'center' },
          ]}
        >
          {t('puzzle.streak', { count: currentStreak })}
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
                  label={t('puzzle.wrongMoves')}
                  value={String(stats.wrongChessMoves)}
                />
                <PuzzleStatRow
                  label={t('puzzle.recognitionErrors')}
                  value={String(stats.recognitionFailures)}
                />
              </>
            )}
            <PuzzleStatRow label={t('puzzle.hintsUsed')} value={String(indices)} />
          </View>
        )}

        {!!solutionLine && (
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 13 }}>
            {formatSanLineForDisplay(solutionLine, chessNotation)}
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
            {t('puzzle.nextPuzzle')}
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
            {t('puzzle.retryPuzzle')}
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
            {t('puzzle.replaySolution')}
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
            {t('puzzle.menu')}
          </Text>
        </Pressable>
      </ScrollView>
    </ModeScreenShell>
  );
}
