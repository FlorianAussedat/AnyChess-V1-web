import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { usePreferences } from '@/hooks/usePreferences';
import {
  formatNumberedSanForDisplay,
  formatSanForDisplay,
  formatSanLineForDisplay,
} from '@/lib/chess/notation';
import type { DeviationAnalysis } from '@/lib/repertoire/RepertoireDeviationAnalyzer';

interface Props {
  visible: boolean;
  analysis: DeviationAnalysis | null;
  onClose: () => void;
}

/**
 * Read-only panel showing what the repertoire offered when the player left
 * theory. Does not alter the live game position.
 */
export function TheoryContinuationViewer({ visible, analysis, onClose }: Props) {
  const colors = useColors();
  const { chessNotation } = usePreferences();
  if (!analysis) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>Ligne théorique</Text>

          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 10 }}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Votre coup</Text>
            <Text style={[styles.value, { color: colors.foreground }]}>
              {formatNumberedSanForDisplay(analysis.playedNumbered, chessNotation)}
            </Text>

            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Coups théoriques disponibles
            </Text>
            {analysis.availableMoves.length === 0 ? (
              <Text style={[styles.value, { color: colors.mutedForeground }]}>
                Aucun coup théorique à cette position.
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
                  Continuation proposée
                  {analysis.continuationRootSan
                    ? ` (via ${formatSanForDisplay(analysis.continuationRootSan, chessNotation)})`
                    : ''}
                </Text>
                {analysis.sourceHints.length > 0 && (
                  <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                    Source{analysis.sourceHints.length > 1 ? 's' : ''} :{' '}
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
          >
            <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold' }}>
              Fermer
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  title: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  label: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  value: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  hint: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  bullet: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  continuation: { fontSize: 14, fontFamily: 'Inter_500Medium', lineHeight: 22 },
  closeBtn: {
    marginTop: 8,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
});
