import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { ModeScreenShell } from '@/components/ModeScreenShell';
import { OptionChip } from '@/components/ui/OptionChip';
import { AppButton } from '@/components/ui/AppButton';
import { DiscreteSlider } from '@/components/ui/DiscreteSlider';
import { blindStyles } from '@/components/blind/blindStyles';
import { useBlindSequence } from '@/contexts/BlindSequenceContext';
import { halfMoveCount } from '@/lib/blind';
import {
  BLIND_SPEED_MAX,
  BLIND_SPEED_MIN,
  DEFAULT_BLIND_SPEED,
  type BlindPerspective,
} from '@/lib/blind';

const PERSPECTIVE_OPTIONS: { id: BlindPerspective; label: string }[] = [
  { id: 'white', label: 'Blancs' },
  { id: 'black', label: 'Noirs' },
  { id: 'random', label: 'Aléatoire' },
];

export function BlindSettingsPhase() {
  const colors = useColors();
  const {
    submode,
    perspective,
    fullMoves,
    speed,
    modeRecordBest,
    setPerspective,
    setFullMoves,
    setSpeed,
    startSession,
    isGenerating,
    generateError,
    backToHub,
  } = useBlindSequence();

  const title =
    submode === 'watch-recite' ? 'Regarder puis réciter' : 'Écouter puis reconstruire';

  return (
    <ModeScreenShell title={title} onBack={backToHub}>
      <ScrollView contentContainerStyle={blindStyles.settingsBody}>
        <Text
          style={[blindStyles.recordLine, { color: colors.mutedForeground }]}
          testID="blind-mode-record"
        >
          {modeRecordBest > 0
            ? `Record : ${modeRecordBest} coups complets`
            : 'Record : 0'}
        </Text>

        <Text style={[blindStyles.sectionLabel, { color: colors.mutedForeground }]}>
          PERSPECTIVE
        </Text>
        <View style={blindStyles.row}>
          {PERSPECTIVE_OPTIONS.map((opt) => (
            <OptionChip
              key={opt.id}
              label={opt.label}
              active={perspective === opt.id}
              onPress={() => setPerspective(opt.id)}
            />
          ))}
        </View>
        <Text style={[blindStyles.hint, { color: colors.mutedForeground }]}>
          Les Blancs jouent toujours en premier. 1 coup complet = 1 coup Blanc + 1 coup Noir.
        </Text>

        <DiscreteSlider
          testID="blind-full-moves-slider"
          label="Coups complets"
          valueLabel={String(fullMoves)}
          minimumValue={1}
          maximumValue={20}
          step={1}
          value={fullMoves}
          onValueChange={setFullMoves}
          leftHint="1"
          rightHint="20"
          accessibilityLabel="Coups complets"
        />
        <Text style={[blindStyles.hint, { color: colors.mutedForeground }]}>
          {fullMoves} coups complets = {halfMoveCount(fullMoves)} demi-coups
          {fullMoves === 20 ? ' (maximum)' : ''}
        </Text>

        <DiscreteSlider
          testID="blind-speed-slider"
          label={`Vitesse (${BLIND_SPEED_MIN}–${BLIND_SPEED_MAX})`}
          valueLabel={String(speed)}
          minimumValue={BLIND_SPEED_MIN}
          maximumValue={BLIND_SPEED_MAX}
          step={1}
          value={speed}
          onValueChange={setSpeed}
          leftHint="Lent"
          rightHint="Rapide"
          accessibilityLabel="Vitesse"
        />
        <Text style={[blindStyles.hint, { color: colors.mutedForeground }]}>
          {speed <= 3
            ? 'Lent — plus de temps entre les coups'
            : speed >= 8
              ? 'Rapide — enchaînement serré'
              : `Vitesse ${speed} (défaut ${DEFAULT_BLIND_SPEED})`}
          {submode === 'listen-reconstruct'
            ? ' · dictée orale'
            : ' · observation visuelle'}
        </Text>

        {!!generateError && (
          <Text style={{ color: colors.destructive, fontFamily: 'Inter_400Regular', fontSize: 13 }}>
            {generateError}
          </Text>
        )}

        {isGenerating ? <ActivityIndicator color={colors.primary} /> : null}
        <AppButton
          label="Générer la séquence"
          onPress={() => startSession()}
          disabled={isGenerating}
          testID="blind-generate"
        />
      </ScrollView>
    </ModeScreenShell>
  );
}
