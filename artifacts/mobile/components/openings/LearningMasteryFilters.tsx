import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { OptionChip } from '@/components/ui/OptionChip';
import { DesignTokens } from '@/constants/designTokens';
import type { OpeningLearningFilter } from '@/lib/repertoire';
import { useTranslation } from '@/hooks/useTranslation';

type Counts = Record<OpeningLearningFilter, number>;

const FILTERS: OpeningLearningFilter[] = [
  'unmastered',
  'partial',
  'mastered',
  'priority',
  'all',
];

const LABEL: Record<OpeningLearningFilter, 'openings.filterUnmastered' | 'openings.filterPartial' | 'openings.filterMastered' | 'openings.filterPriority' | 'openings.filterAll'> = {
  unmastered: 'openings.filterUnmastered',
  partial: 'openings.filterPartial',
  mastered: 'openings.filterMastered',
  priority: 'openings.filterPriority',
  all: 'openings.filterAll',
};

type Props = {
  value: OpeningLearningFilter;
  counts: Counts;
  onChange: (filter: OpeningLearningFilter) => void;
};

export function LearningMasteryFilters({ value, counts, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      testID="learn-mastery-filters"
    >
      {FILTERS.map((filter) => (
        <OptionChip
          key={filter}
          label={`${t(LABEL[filter])} ${counts[filter]}`}
          active={value === filter}
          onPress={() => onChange(filter)}
          testID={`learn-filter-${filter}`}
        />
      ))}
    </ScrollView>
  );
}

export function emptyFilterCopy(
  filter: OpeningLearningFilter,
):
  | 'openings.emptyFilterUnmastered'
  | 'openings.emptyFilterPartial'
  | 'openings.emptyFilterMastered'
  | 'openings.emptyFilterPriority'
  | 'openings.emptyFilterAll' {
  if (filter === 'unmastered') return 'openings.emptyFilterUnmastered';
  if (filter === 'partial') return 'openings.emptyFilterPartial';
  if (filter === 'mastered') return 'openings.emptyFilterMastered';
  if (filter === 'priority') return 'openings.emptyFilterPriority';
  return 'openings.emptyFilterAll';
}

const styles = StyleSheet.create({
  row: {
    gap: DesignTokens.spacing.sm,
    paddingVertical: 2,
  },
});
