import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { ModeScreenShell } from '@/components/ModeScreenShell';
import { AppButton } from '@/components/ui/AppButton';
import { blindStyles } from '@/components/blind/blindStyles';
import { useBlindSequence } from '@/contexts/BlindSequenceContext';
import { halfMoveCount } from '@/lib/blind';

export function BlindDictationPhase() {
  const colors = useColors();
  const {
    fullMoves,
    sequence,
    isSpeaking,
    dictationSpokenCount,
    dictationComplete,
    replayDictation,
    startReconstruction,
    backToSettings,
  } = useBlindSequence();

  const total = sequence.length || halfMoveCount(fullMoves);
  const showReady = dictationComplete && !isSpeaking;
  const showInProgress = !showReady;

  return (
    <ModeScreenShell title="Dictée" onBack={backToSettings}>
      <View style={blindStyles.phaseBody}>
        <View
          style={[
            blindStyles.hiddenCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Ionicons name="ear-outline" size={48} color={colors.mutedForeground} />
          <Text style={[blindStyles.hiddenTitle, { color: colors.foreground }]}>
            Échiquier masqué
          </Text>
          <Text style={[blindStyles.hint, { color: colors.mutedForeground, textAlign: 'center' }]}>
            Écoute les {total} demi-coups. Aucune notation affichée.
          </Text>
          {showInProgress && (
            <Text
              style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold', marginTop: 8 }}
              testID="blind-dictation-progress"
            >
              Dictée en cours
              {dictationSpokenCount > 0 ? ` · ${dictationSpokenCount} / ${total}` : ''}
            </Text>
          )}
          {showReady && (
            <>
              <Text
                style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', marginTop: 10 }}
                testID="blind-dictation-done"
              >
                Dictée terminée
              </Text>
              <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 16 }}>
                À ton tour
              </Text>
            </>
          )}
        </View>
        <AppButton
          label="Rejouer la séquence"
          variant="secondary"
          onPress={replayDictation}
          disabled={isSpeaking}
        />
        <Pressable
          onPress={startReconstruction}
          style={({ pressed }) => [
            blindStyles.cta,
            { backgroundColor: colors.primary, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Ionicons name="grid-outline" size={18} color={colors.primaryForeground} />
          <Text style={[blindStyles.ctaLabel, { color: colors.primaryForeground }]}>
            Commencer la reconstruction
          </Text>
        </Pressable>
      </View>
    </ModeScreenShell>
  );
}
