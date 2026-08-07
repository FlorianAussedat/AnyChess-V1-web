import React from 'react';
import { ScrollView, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { ModeScreenShell } from '@/components/ModeScreenShell';
import { HubModeCard } from '@/components/HubModeCard';
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

        <HubModeCard
          title="Écouter puis reconstruire"
          description="Écoute une séquence, puis rejoue les coups sur l’échiquier."
          iconName="ear-outline"
          onPress={() => selectSubmode('listen-reconstruct')}
          testID="blind-mode-listen"
        />

        <HubModeCard
          title="Regarder puis réciter"
          description="Observe une séquence, puis récite les coups de mémoire."
          iconName="eye-outline"
          onPress={() => selectSubmode('watch-recite')}
          testID="blind-mode-watch"
        />
      </ScrollView>
    </ModeScreenShell>
  );
}
