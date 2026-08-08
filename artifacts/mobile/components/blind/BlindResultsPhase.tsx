import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { ChessBoard } from '@/components/ChessBoard';
import { AppButton } from '@/components/ui/AppButton';
import { ModeScreenShell } from '@/components/ModeScreenShell';
import { BlindStatRow } from '@/components/blind/BlindStatRow';
import { blindStyles } from '@/components/blind/blindStyles';
import { useBlindSequence } from '@/contexts/BlindSequenceContext';
import { useBoardSize } from '@/hooks/useBoardSize';
import { blindRecordFullMoves } from '@/lib/blind';

export function BlindResultsPhase() {
  const colors = useColors();
  const boardSize = useBoardSize('wide');
  const {
    score,
    submode,
    board,
    lastMove,
    orientation,
    sequence,
    observationIndex,
    isReplaying,
    recordEligible,
    isNewRecord,
    modeRecordBest,
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
      <ModeScreenShell title="Résultat" onBack={backToSettings}>
        <ActivityIndicator color={colors.primary} />
      </ModeScreenShell>
    );
  }

  const targetFullMoves = blindRecordFullMoves(score.totalHalfMoves);
  const completedFullMoves = blindRecordFullMoves(score.correctOnFirstAttempt);
  const perfect =
    score.accuracyPercent === 100 &&
    score.correctOnFirstAttempt === score.totalHalfMoves &&
    recordEligible;
  const statusLine = perfect
    ? 'Sans aide'
    : score.helpsUsed > 0
      ? 'Aide utilisée'
      : 'Avec erreur';

  return (
    <ModeScreenShell title="Résultat" onBack={() => router.push('/' as Href)}>
      <ScrollView contentContainerStyle={blindStyles.settingsBody}>
        <Text
          style={[blindStyles.scoreHero, { color: colors.primary }]}
          testID="blind-result-full-moves"
        >
          {completedFullMoves} / {targetFullMoves} réussis
        </Text>
        <Text
          style={{
            color: colors.foreground,
            fontFamily: 'Inter_700Bold',
            fontSize: 28,
            textAlign: 'center',
          }}
        >
          {score.accuracyPercent} %
        </Text>
        <Text
          style={{
            color: perfect ? colors.primary : colors.mutedForeground,
            fontFamily: 'Inter_600SemiBold',
            textAlign: 'center',
            fontSize: 15,
          }}
          testID="blind-result-status"
        >
          {statusLine}
        </Text>

        {isNewRecord ? (
          <Text
            style={{
              color: colors.primary,
              fontFamily: 'Inter_700Bold',
              textAlign: 'center',
              fontSize: 16,
              marginTop: 4,
            }}
            testID="blind-new-record"
          >
            Nouveau record : {targetFullMoves} coups complets
          </Text>
        ) : (
          <Text
            style={[blindStyles.recordLine, { color: colors.mutedForeground, textAlign: 'center' }]}
          >
            Record : {modeRecordBest} coups complets
          </Text>
        )}

        {!recordEligible && (
          <Text
            style={{
              color: colors.mutedForeground,
              fontFamily: 'Inter_400Regular',
              textAlign: 'center',
              fontSize: 12,
            }}
          >
            Record non éligible pour cette tentative
          </Text>
        )}

        {(submode === 'watch-recite' || submode === 'listen-reconstruct') && (
          <View style={{ alignItems: 'center', gap: 8, alignSelf: 'center', width: boardSize }}>
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
              sizeMode="wide"
              size={boardSize}
            />
          </View>
        )}

        <View
          style={[blindStyles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Text
            style={{
              color: colors.mutedForeground,
              fontFamily: 'Inter_500Medium',
              fontSize: 11,
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            Détail
          </Text>
          {perfect ? null : (
            <BlindStatRow
              label="Coups corrects au premier essai"
              value={score.correctOnFirstAttempt}
            />
          )}
          {submode === 'listen-reconstruct' ? (
            <>
              <BlindStatRow label="Erreurs de pièce" value={score.wrongPiece} />
              <BlindStatRow label="Erreurs de destination" value={score.wrongDestination} />
              <BlindStatRow label="Erreurs d’ordre" value={score.wrongOrder} />
              <BlindStatRow label="Aides utilisées" value={score.helpsUsed} />
            </>
          ) : (
            <>
              <BlindStatRow label="Erreurs de coup" value={score.wrongMove} />
              <BlindStatRow label="Erreurs d’ordre" value={score.wrongOrder} />
              <BlindStatRow
                label="Erreurs de reconnaissance non comptabilisées"
                value={score.recognitionFailures}
              />
              <BlindStatRow label="Aides utilisées" value={score.helpsUsed} />
            </>
          )}
        </View>

        <AppButton
          label="Refaire la même séquence"
          variant="secondary"
          onPress={retrySameSequence}
          disabled={isReplaying}
          testID="blind-retry-same"
        />

        {submode === 'watch-recite' && (
          <AppButton
            label="Revoir la séquence"
            variant="secondary"
            onPress={reviewSequenceVisually}
            disabled={isReplaying}
          />
        )}

        <Pressable
          onPress={() => generateNewSequence()}
          disabled={isGenerating || isReplaying}
          style={({ pressed }) => [
            blindStyles.cta,
            {
              backgroundColor: colors.primary,
              opacity: isGenerating || isReplaying || pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text style={[blindStyles.ctaLabel, { color: colors.primaryForeground }]}>
            Nouvelle séquence
          </Text>
        </Pressable>

        <AppButton
          label="Menu des exercices"
          variant="secondary"
          onPress={backToHub}
          disabled={isReplaying}
        />
      </ScrollView>
    </ModeScreenShell>
  );
}
