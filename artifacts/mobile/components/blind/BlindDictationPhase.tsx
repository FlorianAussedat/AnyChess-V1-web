import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { ModeScreenShell } from '@/components/ModeScreenShell';
import { AppButton } from '@/components/ui/AppButton';
import { blindStyles } from '@/components/blind/blindStyles';
import { useBlindSequence } from '@/contexts/BlindSequenceContext';
import { halfMoveCount } from '@/lib/blind';

export function BlindDictationPhase() {
  const colors = useColors();
  const { t } = useTranslation();
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
    <ModeScreenShell title={t('blind.dictation')} onBack={backToSettings}>
      <View style={blindStyles.phaseBody}>
        <View
          style={[
            blindStyles.hiddenCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Ionicons name="ear-outline" size={48} color={colors.mutedForeground} />
          <Text style={[blindStyles.hiddenTitle, { color: colors.foreground }]}>
            {t('a11y.boardHidden')}
          </Text>
          <Text style={[blindStyles.hint, { color: colors.mutedForeground, textAlign: 'center' }]}>
            {t('blind.dictationListen', { total })}
          </Text>
          {showInProgress && (
            <Text
              style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold', marginTop: 8 }}
              testID="blind-dictation-progress"
            >
              {t('blind.dictationInProgress')}
              {dictationSpokenCount > 0 ? ` · ${dictationSpokenCount} / ${total}` : ''}
            </Text>
          )}
          {showReady && (
            <>
              <Text
                style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', marginTop: 10 }}
                testID="blind-dictation-done"
              >
                {t('blind.dictationDone')}
              </Text>
              <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 16 }}>
                {t('blind.yourTurn')}
              </Text>
            </>
          )}
        </View>
        <AppButton
          label={t('blind.replaySequence')}
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
            {t('blind.startReconstruction')}
          </Text>
        </Pressable>
      </View>
    </ModeScreenShell>
  );
}
