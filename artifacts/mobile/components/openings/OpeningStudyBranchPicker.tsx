import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { formatSanForDisplay } from '@/lib/chess/notation';
import { usePreferences } from '@/hooks/usePreferences';
import { formatNags, type StudyBranchChoice } from '@/lib/openingStudy';
import { DesignTokens } from '@/constants/designTokens';

type Props = {
  visible: boolean;
  choices: StudyBranchChoice[];
  onSelect: (nodeId: string) => void;
};

export function OpeningStudyBranchPicker({ visible, choices, onSelect }: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const { chessNotation } = usePreferences();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          testID="opening-study-branch-picker"
        >
          <Text style={[styles.title, { color: colors.foreground }]}>
            {t('openings.branchPickerTitle')}
          </Text>
          {choices.map((choice) => (
            <Pressable
              key={choice.nodeId}
              onPress={() => onSelect(choice.nodeId)}
              testID={`opening-study-branch-${choice.nodeId}`}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: colors.secondary,
                  borderColor: colors.border,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Text style={[styles.san, { color: colors.foreground }]}>
                {formatSanForDisplay(choice.san, chessNotation)}
                {formatNags(choice.nags)}
              </Text>
              <Text style={[styles.kind, { color: colors.mutedForeground }]}>
                {choice.isMain ? t('openings.mainLine') : t('openings.variation')}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 18,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  title: {
    fontSize: 16,
    fontFamily: DesignTokens.typography.weightSemiBold,
    marginBottom: 4,
  },
  row: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 2,
  },
  san: { fontSize: 16, fontFamily: DesignTokens.typography.weightSemiBold },
  kind: { fontSize: 12, fontFamily: 'Inter_400Regular' },
});
