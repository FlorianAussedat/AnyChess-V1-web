import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
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
  const { t } = useTranslation();
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
      <ModeScreenShell title={t('blind.result')} onBack={backToSettings}>
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
    ? t('blind.withoutHelp')
    : score.helpsUsed > 0
      ? t('blind.hintUsed')
      : t('blind.withError');

  return (
    <ModeScreenShell title={t('blind.result')} onBack={() => router.push('/' as Href)}>
      <ScrollView contentContainerStyle={blindStyles.settingsBody}>
        <Text
          style={[blindStyles.scoreHero, { color: colors.primary }]}
          testID="blind-result-full-moves"
        >
          {t('blind.succeeded', { done: completedFullMoves, total: targetFullMoves })}
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
            {t('blind.newRecord', { count: targetFullMoves })}
          </Text>
        ) : (
          <Text
            style={[blindStyles.recordLine, { color: colors.mutedForeground, textAlign: 'center' }]}
          >
            {t('blind.recordLine', { count: modeRecordBest })}
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
            {t('blind.recordIneligible')}
          </Text>
        )}

        {(submode === 'watch-recite' || submode === 'listen-reconstruct') && (
          <View style={{ alignItems: 'center', gap: 8, alignSelf: 'center', width: boardSize }}>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12 }}>
              {isReplaying
                ? t('blind.replaying', { current: observationIndex, total: sequence.length })
                : t('blind.finalPosition')}
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
            {t('blind.detail')}
          </Text>
          {perfect ? null : (
            <BlindStatRow
              label={t('blind.correctFirstTry')}
              value={score.correctOnFirstAttempt}
            />
          )}
          {submode === 'listen-reconstruct' ? (
            <>
              <BlindStatRow label={t('blind.wrongPiece')} value={score.wrongPiece} />
              <BlindStatRow label={t('blind.wrongDestination')} value={score.wrongDestination} />
              <BlindStatRow label={t('blind.wrongOrder')} value={score.wrongOrder} />
              <BlindStatRow label={t('blind.helpsUsed')} value={score.helpsUsed} />
            </>
          ) : (
            <>
              <BlindStatRow label={t('blind.wrongMove')} value={score.wrongMove} />
              <BlindStatRow label={t('blind.wrongOrder')} value={score.wrongOrder} />
              <BlindStatRow
                label={t('blind.recognitionFailures')}
                value={score.recognitionFailures}
              />
              <BlindStatRow label={t('blind.helpsUsed')} value={score.helpsUsed} />
            </>
          )}
        </View>

        <AppButton
          label={t('blind.retrySame')}
          variant="secondary"
          onPress={retrySameSequence}
          disabled={isReplaying}
          testID="blind-retry-same"
        />

        {submode === 'watch-recite' && (
          <AppButton
            label={t('blind.reviewSequence')}
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
            {t('blind.newSequence')}
          </Text>
        </Pressable>

        <AppButton
          label={t('blind.exercisesMenu')}
          variant="secondary"
          onPress={backToHub}
          disabled={isReplaying}
        />
      </ScrollView>
    </ModeScreenShell>
  );
}
