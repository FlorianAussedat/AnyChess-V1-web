import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { ModeScreenShell } from '@/components/ModeScreenShell';
import { blindStyles } from '@/components/blind/blindStyles';
import { useBlindSequence } from '@/contexts/BlindSequenceContext';
import { halfMoveCount } from '@/lib/blind';

export function BlindDictationPhase() {
  const colors = useColors();
  const { fullMoves, isSpeaking, replayDictation, startReconstruction, backToSettings } =
    useBlindSequence();

  return (
    <ModeScreenShell title="Dictée" onBack={backToSettings}>
      <View style={blindStyles.phaseBody}>
        <View style={[blindStyles.hiddenCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="ear-outline" size={48} color={colors.mutedForeground} />
          <Text style={[blindStyles.hiddenTitle, { color: colors.foreground }]}>Échiquier masqué</Text>
          <Text style={[blindStyles.hint, { color: colors.mutedForeground, textAlign: 'center' }]}>
            Écoute les {halfMoveCount(fullMoves)} demi-coups. Aucune notation affichée.
          </Text>
          {isSpeaking && (
            <Text style={{ color: colors.primary, fontFamily: 'Inter_500Medium', marginTop: 8 }}>
              Dictée en cours…
            </Text>
          )}
        </View>
        <Pressable
          onPress={replayDictation}
          style={({ pressed }) => [
            blindStyles.secondaryCta,
            { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="volume-medium-outline" size={18} color={colors.foreground} />
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
            Rejouer la séquence
          </Text>
        </Pressable>
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
