import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { ChessBoard } from '@/components/ChessBoard';
import { ModeScreenShell } from '@/components/ModeScreenShell';
import { blindStyles } from '@/components/blind/blindStyles';
import { useBlindSequence } from '@/contexts/BlindSequenceContext';
import { useBoardSize } from '@/hooks/useBoardSize';

export function BlindObservingPhase() {
  const colors = useColors();
  const { t } = useTranslation();
  const boardSize = useBoardSize('wide');
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

  const observationDone =
    !isReplaying && observationIndex >= sequence.length && sequence.length > 0;

  return (
    <ModeScreenShell title={t('blind.observation')} onBack={backToSettings}>
      <View style={blindStyles.phaseBody}>
        <Text style={[blindStyles.hint, { color: colors.mutedForeground, textAlign: 'center' }]}>
          {t('blind.observationHint')}
        </Text>
        {!observationDone ? (
          <Text
            style={{
              color: colors.foreground,
              fontFamily: 'Inter_600SemiBold',
              textAlign: 'center',
            }}
            testID="blind-observation-progress"
          >
            {t('blind.observationProgress', { current: observationIndex, total: sequence.length })}
          </Text>
        ) : (
          <>
            <Text
              style={{
                color: colors.foreground,
                fontFamily: 'Inter_600SemiBold',
                textAlign: 'center',
              }}
              testID="blind-observation-done"
            >
              {t('blind.sequenceDone')}
            </Text>
            <Text
              style={{
                color: colors.primary,
                fontFamily: 'Inter_700Bold',
                textAlign: 'center',
                fontSize: 16,
              }}
            >
              {t('blind.yourTurnRecite')}
            </Text>
          </>
        )}
        <View style={{ alignItems: 'center', alignSelf: 'center', width: boardSize }}>
          <ChessBoard
            board={board}
            lastMove={lastMove}
            isFlipped={orientation === 'b'}
            showCoordinates={false}
            sizeMode="wide"
            size={boardSize}
          />
        </View>
        {observationDone && (
          <Pressable
            onPress={startRecitation}
            style={({ pressed }) => [
              blindStyles.cta,
              { backgroundColor: colors.primary, opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <Ionicons name="mic-outline" size={18} color={colors.primaryForeground} />
            <Text style={[blindStyles.ctaLabel, { color: colors.primaryForeground }]}>
              {t('blind.goToRecitation')}
            </Text>
          </Pressable>
        )}
      </View>
    </ModeScreenShell>
  );
}
