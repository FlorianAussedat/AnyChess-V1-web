/**
 * Virtualized PGN game picker — max MAX_PGN_IMPORT_BATCH selections.
 */
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import {
  formatPgnGameIndexTitle,
  type PgnGameIndexEntry,
} from '@/lib/gameLibrary/indexPgnGamesLight';
import { MAX_PGN_IMPORT_BATCH } from '@/lib/gameLibrary/displayNameFromFilename';

export type PgnGameSelectCandidate = PgnGameIndexEntry & {
  /** Stable list id (file + index). */
  id: string;
  sourceLabel?: string;
};

type Props = {
  visible: boolean;
  candidates: PgnGameSelectCandidate[];
  selected: Set<string>;
  onChangeSelected: (next: Set<string>, blocked?: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  indexingLabel?: string | null;
  /** Override default library batch cap (e.g. openings = 100). */
  maxSelection?: number;
};

export function PgnGameSelectModal({
  visible,
  candidates,
  selected,
  onChangeSelected,
  onCancel,
  onConfirm,
  confirmLabel,
  indexingLabel,
  maxSelection = MAX_PGN_IMPORT_BATCH,
}: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [capHint, setCapHint] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) => {
      const hay = [
        c.white,
        c.black,
        c.event,
        c.date,
        c.site,
        c.result,
        c.sourceLabel,
        formatPgnGameIndexTitle(c),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [candidates, query]);

  const selectedCount = selected.size;
  const importLabel =
    confirmLabel ??
    t('parties.importSelectedCount', { count: String(selectedCount) });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.modalBackdrop}>
        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
          testID="parties-game-select"
        >
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>
            {t('parties.gameSelectTitle')}
          </Text>
          <Text
            style={{ color: colors.mutedForeground, marginBottom: 6 }}
            testID="parties-game-select-found"
          >
            {t('parties.gameSelectFound', {
              count: String(candidates.length),
            })}
          </Text>
          {indexingLabel ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
              {indexingLabel}
            </Text>
          ) : null}
          <Text
            style={{ color: colors.mutedForeground, marginBottom: 8 }}
            testID="parties-game-select-count"
          >
            {t('parties.multiSelectCount', {
              selected: String(selectedCount),
              max: String(maxSelection),
            })}
          </Text>

          <TextInput
            testID="parties-game-select-search"
            value={query}
            onChangeText={setQuery}
            placeholder={t('parties.gameSelectSearch')}
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.search,
              {
                color: colors.foreground,
                borderColor: colors.border,
                backgroundColor: colors.background,
              },
            ]}
          />

          {capHint ? (
            <Text
              testID="parties-game-select-cap"
              style={{ color: colors.destructive, marginBottom: 6, fontSize: 12 }}
            >
              {capHint}
            </Text>
          ) : null}

          <FlatList
            testID="parties-game-select-list"
            data={filtered}
            keyExtractor={(item) => item.id}
            style={styles.list}
            initialNumToRender={16}
            maxToRenderPerBatch={24}
            windowSize={7}
            getItemLayout={(_data, index) => ({
              length: 64,
              offset: 64 * index,
              index,
            })}
            renderItem={({ item }) => {
              const isOn = selected.has(item.id);
              return (
                <Pressable
                  testID={`parties-game-row-${item.id}`}
                  onPress={() => {
                    const next = new Set(selected);
                    if (next.has(item.id)) {
                      next.delete(item.id);
                      setCapHint(null);
                      onChangeSelected(next, false);
                      return;
                    }
                    if (next.size >= maxSelection) {
                      setCapHint(t('parties.gameSelectMax'));
                      onChangeSelected(next, true);
                      return;
                    }
                    next.add(item.id);
                    setCapHint(null);
                    onChangeSelected(next, false);
                  }}
                  style={[
                    styles.row,
                    {
                      borderColor: colors.border,
                      backgroundColor: isOn ? colors.primary : colors.secondary,
                      height: 60,
                    },
                  ]}
                >
                  <View style={styles.rowText}>
                    <Text
                      numberOfLines={2}
                      style={{
                        color: isOn
                          ? colors.primaryForeground
                          : colors.foreground,
                        fontSize: 13,
                        fontFamily: DesignTokens.typography.weightSemiBold,
                      }}
                    >
                      {formatPgnGameIndexTitle(item)}
                    </Text>
                    {item.sourceLabel ? (
                      <Text
                        numberOfLines={1}
                        style={{
                          color: isOn
                            ? colors.primaryForeground
                            : colors.mutedForeground,
                          fontSize: 11,
                          marginTop: 2,
                        }}
                      >
                        {item.sourceLabel}
                      </Text>
                    ) : null}
                  </View>
                  <Text
                    style={{
                      color: isOn
                        ? colors.primaryForeground
                        : colors.mutedForeground,
                      fontSize: 16,
                    }}
                  >
                    {isOn ? '✓' : '○'}
                  </Text>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <Text style={{ color: colors.mutedForeground, padding: 12 }}>
                {t('parties.gameSelectEmpty')}
              </Text>
            }
          />

          <View style={styles.modalActions}>
            <Pressable
              onPress={onCancel}
              style={[styles.modalBtn, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.foreground }}>
                {t('common.cancel')}
              </Text>
            </Pressable>
            <Pressable
              testID="parties-game-select-import"
              disabled={selectedCount === 0}
              onPress={onConfirm}
              style={[
                styles.modalBtnPrimary,
                {
                  backgroundColor: colors.primary,
                  opacity: selectedCount === 0 ? 0.5 : 1,
                },
              ]}
            >
              <Text style={{ color: '#fff' }}>{importLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.lg,
    padding: DesignTokens.spacing.md,
    maxHeight: '88%',
    gap: 4,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  search: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
    fontSize: 14,
  },
  list: {
    maxHeight: 360,
    minHeight: 180,
  },
  row: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowText: { flex: 1, minWidth: 0 },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  modalBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modalBtnPrimary: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});
