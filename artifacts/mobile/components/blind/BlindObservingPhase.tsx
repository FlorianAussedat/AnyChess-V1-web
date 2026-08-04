import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { ChessBoard } from '@/components/ChessBoard';
import { ModeScreenShell } from '@/components/ModeScreenShell';
import { blindStyles } from '@/components/blind/blindStyles';
import { useBlindSequence } from '@/contexts/BlindSequenceContext';

export function BlindObservingPhase() {
  const colors = useColors();
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

  const observationDone = !isReplaying && observationIndex >= sequence.length && sequence.length > 0;

  return (
    <ModeScreenShell title="Observation" onBack={backToSettings}>
      <View style={blindStyles.phaseBody}>
        <Text style={[blindStyles.hint, { color: colors.mutedForeground, textAlign: 'center' }]}>
          Regarde la séquence — aucune annonce orale.
        </Text>
        <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', textAlign: 'center' }}>
          Coup {observationIndex} / {sequence.length}
        </Text>
        <View style={{ alignItems: 'center' }}>
          <ChessBoard
            board={board}
            lastMove={lastMove}
            isFlipped={orientation === 'b'}
            showCoordinates={false}
          />
        </View>
        {observationDone && (
          <>
            <Text style={[blindStyles.hint, { color: colors.mutedForeground, textAlign: 'center' }]}>
              Séquence terminée. Mémorise la position finale, puis commence la récitation.
            </Text>
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
          </>
        )}
      </View>
    </ModeScreenShell>
  );
}
