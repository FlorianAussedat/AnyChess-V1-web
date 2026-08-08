import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
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

export function BlindSettingsPhase() {
  const colors = useColors();
  const { t } = useTranslation();
  const perspectiveOptions: { id: BlindPerspective; label: string }[] = [
    { id: 'white', label: t('common.whites') },
    { id: 'black', label: t('common.blacks') },
    { id: 'random', label: t('common.random') },
  ];
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
    submode === 'watch-recite' ? t('blind.watchRecite') : t('blind.listenReconstruct');

  return (
    <ModeScreenShell title={title} onBack={backToHub}>
      <ScrollView contentContainerStyle={blindStyles.settingsBody}>
        <Text
          style={[blindStyles.recordLine, { color: colors.mutedForeground }]}
          testID="blind-mode-record"
        >
          {modeRecordBest > 0
            ? t('blind.record', { count: modeRecordBest })
            : t('blind.recordZero')}
        </Text>

        <Text style={[blindStyles.sectionLabel, { color: colors.mutedForeground }]}>
          {t('blind.perspective')}
        </Text>
        <View style={blindStyles.row}>
          {perspectiveOptions.map((opt) => (
            <OptionChip
              key={opt.id}
              label={opt.label}
              active={perspective === opt.id}
              onPress={() => setPerspective(opt.id)}
            />
          ))}
        </View>
        <Text style={[blindStyles.hint, { color: colors.mutedForeground }]}>
          {t('blind.perspectiveHint')}
        </Text>

        <DiscreteSlider
          testID="blind-full-moves-slider"
          label={t('blind.fullMoves')}
          valueLabel={String(fullMoves)}
          minimumValue={1}
          maximumValue={20}
          step={1}
          value={fullMoves}
          onValueChange={setFullMoves}
          leftHint="1"
          rightHint="20"
          accessibilityLabel={t('a11y.fullMoves')}
        />
        <Text style={[blindStyles.hint, { color: colors.mutedForeground }]}>
          {t('blind.fullMovesEq', {
            full: fullMoves,
            half: halfMoveCount(fullMoves),
            max: fullMoves === 20 ? t('blind.maximum') : '',
          })}
        </Text>

        <DiscreteSlider
          testID="blind-speed-slider"
          label={t('blind.speedLabel', { min: BLIND_SPEED_MIN, max: BLIND_SPEED_MAX })}
          valueLabel={String(speed)}
          minimumValue={BLIND_SPEED_MIN}
          maximumValue={BLIND_SPEED_MAX}
          step={1}
          value={speed}
          onValueChange={setSpeed}
          leftHint={t('blind.slow')}
          rightHint={t('blind.fast')}
          accessibilityLabel={t('a11y.speed')}
        />
        <Text style={[blindStyles.hint, { color: colors.mutedForeground }]}>
          {speed <= 3
            ? t('blind.speedSlowHint')
            : speed >= 8
              ? t('blind.speedFastHint')
              : t('blind.speedDefaultHint', { speed, default: DEFAULT_BLIND_SPEED })}
          {submode === 'listen-reconstruct'
            ? t('blind.oralDictation')
            : t('blind.visualObservation')}
        </Text>

        {!!generateError && (
          <Text style={{ color: colors.destructive, fontFamily: 'Inter_400Regular', fontSize: 13 }}>
            {generateError}
          </Text>
        )}

        {isGenerating ? <ActivityIndicator color={colors.primary} /> : null}
        <AppButton
          label={t('blind.generate')}
          onPress={() => startSession()}
          disabled={isGenerating}
          testID="blind-generate"
        />
      </ScrollView>
    </ModeScreenShell>
  );
}
