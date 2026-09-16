import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { usePreferences } from '@/hooks/usePreferences';
import { useTranslation } from '@/hooks/useTranslation';
import {
  formatNumberedSanForDisplay,
  formatSanForDisplay,
  formatSanLineForDisplay,
} from '@/lib/chess/notation';
import type { DeviationAnalysis } from '@/lib/repertoire/RepertoireDeviationAnalyzer';

interface Props {
  visible: boolean;
  analysis: DeviationAnalysis | null;
  openingLabel?: string | null;
  onClose: () => void;
}

/**
 * Read-only panel showing what the repertoire offered when the player left
 * theory. Does not alter the live game position.
 */
export function TheoryContinuationViewer({
  visible,
  analysis,
  openingLabel,
  onClose,
}: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const { chessNotation } = usePreferences();
  if (!analysis) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {t('openings.theoryLineTitle')}
          </Text>
          {!!openingLabel && (
            <Text style={[styles.opening, { color: colors.mutedForeground }]} numberOfLines={2}>
              {openingLabel}
            </Text>
          )}

          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 10 }}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              {t('openings.playedMoveHeading')}
            </Text>
            <Text style={[styles.value, { color: colors.foreground }]}>
              {formatNumberedSanForDisplay(analysis.playedNumbered, chessNotation)}
            </Text>

            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              {t('openings.availableTheoryMoves')}
            </Text>
            {analysis.availableMoves.length === 0 ? (
              <Text style={[styles.value, { color: colors.mutedForeground }]}>
                —
              </Text>
            ) : (
              analysis.availableMoves.map((m) => (
                <Text key={m.uci} style={[styles.bullet, { color: colors.foreground }]}>
                  • {formatNumberedSanForDisplay(m.numbered, chessNotation)}
                </Text>
              ))
            )}

            {analysis.continuation.length > 0 && (
              <>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>
                  {t('openings.proposedContinuation')}
                  {analysis.continuationRootSan
                    ? ` (via ${formatSanForDisplay(analysis.continuationRootSan, chessNotation)})`
                    : ''}
                </Text>
                {analysis.sourceHints.length > 0 && (
                  <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                    {analysis.sourceHints.join(' · ')}
                  </Text>
                )}
                <Text style={[styles.continuation, { color: colors.foreground }]}>
                  {formatSanLineForDisplay(
                    analysis.continuation.map((s) => s.numbered).join('  '),
                    chessNotation,
                  )}
                </Text>
              </>
            )}
          </ScrollView>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeBtn,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
            testID="theory-line-close"
          >
            <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold' }}>
              {t('openings.close')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  title: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  opening: { fontSize: 13, fontFamily: 'Inter_500Medium', marginTop: -4 },
  label: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.4 },
  value: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  bullet: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  hint: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  continuation: { fontSize: 14, fontFamily: 'Inter_500Medium', lineHeight: 22 },
  closeBtn: {
    marginTop: 4,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
});
