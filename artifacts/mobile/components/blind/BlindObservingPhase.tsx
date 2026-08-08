import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { ChessBoard } from '@/components/ChessBoard';
import { ModeScreenShell } from '@/components/ModeScreenShell';
import { blindStyles } from '@/components/blind/blindStyles';
import { useBlindSequence } from '@/contexts/BlindSequenceContext';
import { useBoardSize } from '@/hooks/useBoardSize';

export function BlindObservingPhase() {
  const colors = useColors();
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
    <ModeScreenShell title="Observation" onBack={backToSettings}>
      <View style={blindStyles.phaseBody}>
        <Text style={[blindStyles.hint, { color: colors.mutedForeground, textAlign: 'center' }]}>
          Regarde la séquence — aucune annonce orale.
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
            Observation · Coup {observationIndex} / {sequence.length}
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
              Séquence terminée
            </Text>
            <Text
              style={{
                color: colors.primary,
                fontFamily: 'Inter_700Bold',
                textAlign: 'center',
                fontSize: 16,
              }}
            >
              À ton tour de réciter
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
              Passer à la récitation
            </Text>
          </Pressable>
        )}
      </View>
    </ModeScreenShell>
  );
}
