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
import type { BlindPerspective } from '@/lib/blind';

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
    modeRecordBest,
    setPerspective,
    setFullMoves,
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

        <Text
          style={[blindStyles.hint, { color: colors.mutedForeground }]}
          testID="blind-pace-hint"
        >
          {t('settings.dictationPaceHint')}
        </Text>

        {!!generateError && (
          <Text style={{ color: colors.destructive, fontFamily: 'Inter_400Regular', fontSize: 13 }}>
            {generateError}
          </Text>
        )}

        {isGenerating ? <ActivityIndicator color={colors.primary} /> : null}

        <AppButton
          label={t('common.start')}
          onPress={() => void startSession()}
          disabled={isGenerating}
          testID="blind-start"
        />
      </ScrollView>
    </ModeScreenShell>
  );
}
