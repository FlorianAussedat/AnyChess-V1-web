import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { ModeScreenShell } from '@/components/ModeScreenShell';
import { blindStyles } from '@/components/blind/blindStyles';
import { useBlindSequence } from '@/contexts/BlindSequenceContext';

export function BlindHubPhase() {
  const colors = useColors();
  const { selectSubmode } = useBlindSequence();
  const router = useRouter();

  return (
    <ModeScreenShell title="Mémorisation" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={blindStyles.settingsBody}>
        <Text style={[blindStyles.lead, { color: colors.mutedForeground }]}>
          Choisis un exercice. Les séquences sont générées par Stockfish (1 à 20 coups complets).
        </Text>

        <Pressable
          onPress={() => selectSubmode('listen-reconstruct')}
          style={({ pressed }) => [
            blindStyles.modeCard,
            { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Ionicons name="ear-outline" size={28} color={colors.primary} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[blindStyles.modeTitle, { color: colors.foreground }]}>
              Écouter puis reconstruire
            </Text>
            <Text style={[blindStyles.hint, { color: colors.mutedForeground }]}>
              Écoute une séquence, puis rejoue les coups sur l’échiquier.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
        </Pressable>

        <Pressable
          onPress={() => selectSubmode('watch-recite')}
          style={({ pressed }) => [
            blindStyles.modeCard,
            { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Ionicons name="eye-outline" size={28} color={colors.primary} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[blindStyles.modeTitle, { color: colors.foreground }]}>
              Regarder puis réciter
            </Text>
            <Text style={[blindStyles.hint, { color: colors.mutedForeground }]}>
              Observe une séquence, puis récite les coups de mémoire.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
        </Pressable>
      </ScrollView>
    </ModeScreenShell>
  );
}
