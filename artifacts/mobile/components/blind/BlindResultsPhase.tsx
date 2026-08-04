import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { ChessBoard } from '@/components/ChessBoard';
import { ModeScreenShell } from '@/components/ModeScreenShell';
import { BlindStatRow } from '@/components/blind/BlindStatRow';
import { blindStyles } from '@/components/blind/blindStyles';
import { useBlindSequence } from '@/contexts/BlindSequenceContext';

export function BlindResultsPhase() {
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
      <ModeScreenShell title="Résultat" onBack={backToSettings}>
        <ActivityIndicator color={colors.primary} />
      </ModeScreenShell>
    );
  }

  return (
    <ModeScreenShell title="Résultat" onBack={() => router.push('/' as Href)}>
      <ScrollView contentContainerStyle={blindStyles.settingsBody}>
        <Text style={[blindStyles.scoreHero, { color: colors.primary }]}>
          Précision au premier essai : {score.accuracyPercent} %
        </Text>
        <Text style={[blindStyles.lead, { color: colors.foreground }]}>
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

        <View style={[blindStyles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
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

        <Pressable
          onPress={retrySameSequence}
          disabled={isReplaying}
          style={({ pressed }) => [
            blindStyles.secondaryCta,
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
              blindStyles.secondaryCta,
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

        <Pressable
          onPress={backToHub}
          disabled={isReplaying}
          style={({ pressed }) => [
            blindStyles.secondaryCta,
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
    </ModeScreenShell>
  );
}
