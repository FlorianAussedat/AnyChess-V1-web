import { parseReaderPgn } from '@/lib/gameReader/parseReaderPgn';
import { presentAppDialog } from '@/lib/ui/appDialogStore';
import { MAX_PGN_FILE_BYTES } from '@/lib/files/readPgnFile';
/**
 * Shared PGN import panel for Analyses de parties and Mes PGN d’ouverture.
 * File picker + light index are reused; FEN is optional per context.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import {
  pickPgnFiles,
  type PickedPgnCandidate,
} from '@/lib/gameLibrary/pickPgnFiles';
import {
  formatPgnGameIndexTitle,
  MAX_PGN_IMPORT_BATCH,
} from '@/lib/gameLibrary';
import { validateAnalysisFen } from '@/lib/gameLibrary/validateAnalysisFen';
import {
  preparePgnSource,
  preparePgnFiles,
  selectedPgnSlices,
  type PreparedPgnSource,
} from '@/lib/pgnImport/preparePgnLoad';
import {
  PgnGameSelectModal,
  type PgnGameSelectCandidate,
} from '@/components/parties/PgnGameSelectModal';
import type { PickedPgnFile } from '@/lib/repertoire/pickPgnFile';

export type PgnImportGame = {
  pgnText: string;
  displayName?: string;
  filename?: string;
};

export type PgnImportPayload =
  { kind: 'pgn'; games: PgnImportGame[] } | { kind: 'fen'; fen: string };

export type PgnImportMode = 'file' | 'pgn' | 'fen';

type Props = {
  allowFen?: boolean;
  maxGameSelection?: number;
  onLoad: (payload: PgnImportPayload) => Promise<void | {
    imported: number;
    failed: number;
    errors?: string[];
  }> | void;
};

export function PgnImportPanel({
  allowFen = false,
  maxGameSelection = 1,
  onLoad,
}: Props) {
  const colors = useColors();
  const { t } = useTranslation();

  const [mode, setMode] = useState<PgnImportMode>('file');
  const [pgnDraft, setPgnDraft] = useState('');
  const [fenDraft, setFenDraft] = useState('');
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<PreparedPgnSource | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const operation = useRef(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  const [gameSelect, setGameSelect] = useState<{
    source: PreparedPgnSource;
    candidates: PgnGameSelectCandidate[];
    selected: Set<string>;
  } | null>(null);
  const [multiSelect, setMultiSelect] = useState<{
    candidates: PickedPgnCandidate[];
    selected: Set<string>;
    resolveSelected: (ids: string[]) => Promise<PickedPgnFile[]>;
  } | null>(null);

  const modes = useMemo(() => {
    const items: { id: PgnImportMode; label: string }[] = [
      { id: 'file', label: t('parties.importFilePgn') },
      { id: 'pgn', label: t('parties.pastePgn') },
    ];
    if (allowFen) items.push({ id: 'fen', label: t('parties.pasteFen') });
    return items;
  }, [allowFen, t]);

  const applyPrepared = useCallback(
    (source: PreparedPgnSource) => {
      if (source.entries.length === 0) {
        setPrepared(null);
        setSelectedIndices([]);
        setFileLabel(source.filename ?? null);
        setError(t('parties.pgnInvalid'));
        return;
      }
      if (source.entries.length === 1) {
        setPrepared(source);
        setSelectedIndices([source.entries[0]!.index]);
        setFileLabel(
          source.filename ?? formatPgnGameIndexTitle(source.entries[0]!),
        );
        setError(null);
        return;
      }
      setGameSelect({
        source,
        candidates: source.entries.map((entry) => ({
          ...entry,
          id: `g-${entry.index}`,
          sourceLabel:
            source.filenamesByIndex?.[entry.index] ?? source.filename,
        })),
        selected: new Set(),
      });
    },
    [t],
  );

  const ingestFiles = useCallback(
    async (files: PickedPgnFile[]) => {
      if (files.length === 0) return;
      const { source, issues } = preparePgnFiles(files);
      setWarnings(
        issues.map(
          (issue) =>
            `${issue.filename}: ${t(issue.reason === 'tooLarge' ? 'files.tooLarge' : issue.reason === 'empty' ? 'files.empty' : issue.reason === 'invalid' ? 'files.invalidPgn' : 'files.unreadable')}`,
        ),
      );
      setMode('file');
      applyPrepared(source);
    },
    [applyPrepared, t],
  );

  const onPickFile = useCallback(async () => {
    if (operation.current) return;
    operation.current = true;
    setError(null);
    setBusy(true);
    try {
      const picked = await pickPgnFiles();
      if (picked.kind === 'cancelled') return;
      if (picked.kind === 'needsSelection') {
        setMultiSelect({
          candidates: picked.candidates,
          selected: new Set(),
          resolveSelected: picked.resolveSelected,
        });
        return;
      }
      await ingestFiles(picked.files);
    } catch (e) {
      setError(t('parties.importFailed'));
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }, [ingestFiles, t]);

  const confirmMultiSelect = useCallback(async () => {
    if (operation.current || !multiSelect || multiSelect.selected.size === 0)
      return;
    operation.current = true;
    setBusy(true);
    try {
      const files = await multiSelect.resolveSelected([
        ...multiSelect.selected,
      ]);
      setMultiSelect(null);
      await ingestFiles(files);
    } catch (e) {
      setError(t('parties.importFailed'));
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }, [ingestFiles, multiSelect, t]);

  const confirmGameSelect = useCallback(() => {
    if (!gameSelect || gameSelect.selected.size === 0) return;
    if (gameSelect.selected.size > maxGameSelection) {
      setError(t('parties.gameSelectMax', { count: String(maxGameSelection) }));
      return;
    }
    const indices = [...gameSelect.selected]
      .map((id) => Number(id.replace(/^g-/, '')))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
    if (indices.length === 0) return;
    setPrepared(gameSelect.source);
    setSelectedIndices(indices);
    setFileLabel(
      gameSelect.source.filename ??
        formatPgnGameIndexTitle(
          gameSelect.source.entries.find((e) => e.index === indices[0]) ??
            gameSelect.source.entries[0]!,
        ),
    );
    setGameSelect(null);
    setError(null);
  }, [gameSelect, maxGameSelection, t]);

  const onCharger = useCallback(async () => {
    if (operation.current) return;
    operation.current = true;
    setError(null);
    setBusy(true);
    const loadGames = async (games: PgnImportGame[]) => {
      const valid: PgnImportGame[] = [],
        invalid: string[] = [];
      for (const [index, game] of games.entries()) {
        let ok = false;
        try {
          ok = parseReaderPgn(game.pgnText, { allowEmptyMoves: true }).ok;
        } catch {
          /* Keep processing other selected games. */
        }
        if (ok) valid.push(game);
        else
          invalid.push(
            `${game.filename ?? ''} · ${game.displayName ?? index + 1}: ${t('files.invalidPgn')}`,
          );
      }
      if (!valid.length) {
        setError(invalid.join('\n') || t('parties.pgnInvalid'));
        return;
      }
      const report = await onLoad({ kind: 'pgn', games: valid });
      presentAppDialog({
        title: t('files.importSummary'),
        variant: 'info',
        message: [
          t('files.imported', {
            count: String(report?.imported ?? valid.length),
            failed: String(
              (report?.failed ?? 0) + invalid.length + warnings.length,
            ),
          }),
          ...warnings,
          ...invalid,
          ...(report?.errors ?? []),
          t('files.duplicates'),
        ].join('\n'),
      });
    };
    try {
      if (mode === 'fen') {
        const checked = validateAnalysisFen(fenDraft);
        if (!checked.ok) {
          setError(t('parties.fenInvalid'));
          return;
        }
        await onLoad({ kind: 'fen', fen: checked.fen });
        return;
      }
      if (mode === 'pgn') {
        if (pgnDraft.length > MAX_PGN_FILE_BYTES) {
          setError(t('files.tooLarge'));
          return;
        }
        const source = preparePgnSource(pgnDraft, 'pasted.pgn');
        if (source.entries.length === 0) {
          setError(t('parties.pgnInvalid'));
          return;
        }
        if (source.entries.length > 1 && selectedIndices.length === 0) {
          applyPrepared(source);
          return;
        }
        const indices =
          source.entries.length === 1
            ? [source.entries[0]!.index]
            : selectedIndices;
        const games = selectedPgnSlices(source, indices).map((item) => ({
          ...item,
          filename: item.filename ?? source.filename,
        }));
        if (games.length === 0) {
          setError(t('parties.pgnInvalid'));
          return;
        }
        await loadGames(games);
        return;
      }
      if (!prepared || selectedIndices.length === 0) {
        setError(t('parties.pgnInvalid'));
        return;
      }
      const games = selectedPgnSlices(prepared, selectedIndices).map(
        (item) => ({
          ...item,
          filename: item.filename ?? prepared.filename,
        }),
      );
      if (games.length === 0) {
        setError(t('parties.pgnInvalid'));
        return;
      }
      await loadGames(games);
    } catch (e) {
      setError(t('parties.importFailed'));
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }, [
    warnings,
    applyPrepared,
    fenDraft,
    mode,
    onLoad,
    pgnDraft,
    prepared,
    selectedIndices,
    t,
  ]);

  const canLoad =
    !busy &&
    (mode === 'fen'
      ? fenDraft.trim().length > 0
      : mode === 'pgn'
        ? pgnDraft.trim().length > 0
        : prepared != null && selectedIndices.length > 0);

  return (
    <View style={styles.root} testID="pgn-import-panel">
      <View style={styles.tabs} testID="pgn-import-modes">
        {modes.map((item) => {
          const active = mode === item.id;
          return (
            <Pressable
              key={item.id}
              testID={`pgn-import-mode-${item.id}`}
              accessibilityRole="button"
              disabled={busy}
              onPress={() => {
                setMode(item.id);
                setPrepared(null);
                setSelectedIndices([]);
                setWarnings([]);
                setError(null);
              }}
              style={[
                styles.tab,
                {
                  backgroundColor: active ? colors.primary : colors.card,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: active
                      ? colors.primaryForeground
                      : colors.foreground,
                  },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {mode === 'file' ? (
        <View style={styles.block}>
          <Pressable
            testID="pgn-import-pick-file"
            onPress={() => void onPickFile()}
            disabled={busy}
            style={({ pressed }) => [
              styles.primaryBtn,
              {
                backgroundColor: colors.primary,
                opacity: pressed || busy ? 0.8 : 1,
              },
            ]}
          >
            {busy ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <>
                <Ionicons
                  name="document-attach-outline"
                  size={18}
                  color={colors.primaryForeground}
                />
                <Text
                  style={[
                    styles.primaryLabel,
                    { color: colors.primaryForeground },
                  ]}
                >
                  {t('parties.importFilePgn')}
                </Text>
              </>
            )}
          </Pressable>
          {fileLabel ? (
            <Text
              style={[styles.fileHint, { color: colors.mutedForeground }]}
              testID="pgn-import-file-label"
            >
              {fileLabel}
              {selectedIndices.length > 1 ? ` · ${selectedIndices.length}` : ''}
            </Text>
          ) : null}
        </View>
      ) : null}

      {prepared && selectedIndices.length > 0 ? (
        <View testID="pgn-import-selected-games">
          {prepared.entries
            .filter((entry) => selectedIndices.includes(entry.index))
            .map((entry) => (
              <Text key={entry.index} style={{ color: colors.foreground }}>
                {prepared.filenamesByIndex?.[entry.index] ?? prepared.filename}{' '}
                · {formatPgnGameIndexTitle(entry)}
              </Text>
            ))}
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              setGameSelect({
                source: prepared,
                candidates: prepared.entries.map((entry) => ({
                  ...entry,
                  id: `g-${entry.index}`,
                  sourceLabel:
                    prepared.filenamesByIndex?.[entry.index] ??
                    prepared.filename,
                })),
                selected: new Set(selectedIndices.map((i) => `g-${i}`)),
              })
            }
          >
            <Text style={{ color: colors.primary }}>
              {t('files.changeSelection')}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {mode === 'pgn' ? (
        <TextInput
          testID="pgn-import-pgn-input"
          value={pgnDraft}
          onChangeText={(value) => {
            setPgnDraft(value);
            setPrepared(null);
            setSelectedIndices([]);
            setError(null);
          }}
          multiline
          textAlignVertical="top"
          placeholder={t('parties.pastePgnPlaceholder')}
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          style={[
            styles.area,
            {
              color: colors.foreground,
              borderColor: colors.border,
              backgroundColor: colors.card,
            },
          ]}
        />
      ) : null}

      {mode === 'fen' && allowFen ? (
        <TextInput
          testID="pgn-import-fen-input"
          value={fenDraft}
          onChangeText={(value) => {
            setFenDraft(value);
            setError(null);
          }}
          multiline
          textAlignVertical="top"
          placeholder={t('parties.pasteFenPlaceholder')}
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          style={[
            styles.area,
            styles.fenArea,
            {
              color: colors.foreground,
              borderColor: colors.border,
              backgroundColor: colors.card,
            },
          ]}
        />
      ) : null}

      {warnings.map((warning, index) => (
        <Text
          key={index}
          style={{ color: colors.destructive }}
          testID={`pgn-import-warning-${index}`}
        >
          {warning}
        </Text>
      ))}
      {error ? (
        <Text
          style={[styles.error, { color: colors.destructive }]}
          testID="pgn-import-error"
        >
          {error}
        </Text>
      ) : null}

      <Pressable
        testID="pgn-import-load"
        onPress={() => void onCharger()}
        disabled={!canLoad}
        style={({ pressed }) => [
          styles.primaryBtn,
          {
            backgroundColor: colors.primary,
            opacity: pressed || !canLoad ? 0.55 : 1,
          },
        ]}
      >
        <Text
          style={[styles.primaryLabel, { color: colors.primaryForeground }]}
        >
          {t('parties.analyzerLoad')}
        </Text>
      </Pressable>

      <PgnGameSelectModal
        visible={gameSelect != null}
        candidates={gameSelect?.candidates ?? []}
        selected={gameSelect?.selected ?? new Set()}
        onChangeSelected={(next) => {
          setGameSelect((prev) => (prev ? { ...prev, selected: next } : prev));
        }}
        onCancel={() => setGameSelect(null)}
        onConfirm={confirmGameSelect}
        maxSelection={maxGameSelection}
      />

      <Modal
        visible={multiSelect != null}
        transparent
        animationType="fade"
        onRequestClose={() => setMultiSelect(null)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            testID="pgn-import-multi-select"
          >
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {t('files.fileLimit', { count: String(MAX_PGN_IMPORT_BATCH) })}
            </Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {multiSelect?.candidates.map((c) => {
                const selected = multiSelect.selected.has(c.id);
                return (
                  <Pressable
                    key={c.id}
                    accessibilityRole="checkbox"
                    accessibilityLabel={c.filename}
                    accessibilityState={{ checked: selected }}
                    onPress={() => {
                      setMultiSelect((prev) => {
                        if (!prev) return prev;
                        const next = new Set(prev.selected);
                        if (next.has(c.id)) next.delete(c.id);
                        else if (next.size < MAX_PGN_IMPORT_BATCH)
                          next.add(c.id);
                        return { ...prev, selected: next };
                      });
                    }}
                    style={[
                      styles.multiRow,
                      {
                        borderColor: colors.border,
                        backgroundColor: selected
                          ? colors.primary
                          : colors.secondary,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: selected
                          ? colors.primaryForeground
                          : colors.foreground,
                      }}
                    >
                      {c.filename}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setMultiSelect(null)}
                style={[styles.modalBtn, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.foreground }}>
                  {t('common.cancel')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => void confirmMultiSelect()}
                disabled={!multiSelect || multiSelect.selected.size === 0}
                style={[
                  styles.modalBtnPrimary,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Text style={{ color: colors.primaryForeground }}>
                  {t('parties.importAction')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  tabs: { gap: 8 },
  tab: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 52,
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: DesignTokens.typography.weightSemiBold,
    flexShrink: 1,
  },
  block: { gap: 8 },
  primaryBtn: {
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: DesignTokens.typography.weightSemiBold,
    textAlign: 'center',
    flexShrink: 1,
  },
  fileHint: { fontSize: 13, lineHeight: 18 },
  area: {
    minHeight: 160,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 13,
    fontFamily:
      Platform.OS === 'web'
        ? 'monospace'
        : DesignTokens.typography.weightRegular,
  },
  fenArea: { minHeight: 96 },
  error: { fontSize: 13, lineHeight: 18 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
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
  multiRow: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
  },
});
