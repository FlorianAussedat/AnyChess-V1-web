import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useColors } from '@/hooks/useColors';
import { ModeScreenShell } from '@/components/ModeScreenShell';
import { OptionChip } from '@/components/ui/OptionChip';
import { AppButton } from '@/components/ui/AppButton';
import { blindStyles } from '@/components/blind/blindStyles';
import { useBlindSequence } from '@/contexts/BlindSequenceContext';
import { halfMoveCount } from '@/lib/blind';
import {
  BLIND_SPEED_MAX,
  BLIND_SPEED_MIN,
  DEFAULT_BLIND_SPEED,
  type BlindPerspective,
} from '@/lib/blind';

const FULL_MOVE_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1);

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

        <Text style={[blindStyles.sectionLabel, { color: colors.mutedForeground }]}>
          COUPS COMPLETS
        </Text>
        <View style={blindStyles.chipRow}>
          {FULL_MOVE_OPTIONS.map((n) => (
            <OptionChip
              key={n}
              label={String(n)}
              active={fullMoves === n}
              onPress={() => setFullMoves(n)}
            />
          ))}
        </View>
        <Text style={[blindStyles.hint, { color: colors.mutedForeground }]}>
          {fullMoves} coups complets = {halfMoveCount(fullMoves)} demi-coups
          {fullMoves === 20 ? ' (maximum)' : ''}
        </Text>

        <Text style={[blindStyles.sectionLabel, { color: colors.mutedForeground }]}>
          VITESSE ({BLIND_SPEED_MIN}–{BLIND_SPEED_MAX})
        </Text>
        <View style={blindStyles.sliderBlock}>
          <View style={blindStyles.sliderLabels}>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12 }}>
              Lent
            </Text>
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>
              {speed}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12 }}>
              Rapide
            </Text>
          </View>
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={BLIND_SPEED_MIN}
            maximumValue={BLIND_SPEED_MAX}
            step={1}
            value={speed}
            onValueChange={(v) => setSpeed(v)}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.primary}
            accessibilityLabel="Vitesse"
          />
        </View>
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
