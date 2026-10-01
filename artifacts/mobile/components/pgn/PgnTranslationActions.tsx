import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { usePgnCommentTranslations } from '@/hooks/usePgnCommentTranslations';
import {
  applyFrenchToPgnText,
  collectPgnCommentUnits,
  describePgnFileTranslation,
  enqueueExistingPgns,
  pgnTranslationQueue,
  type PgnCommentSource,
  type PgnExportMode,
} from '@/lib/pgnComments';
import { downloadPgnFile } from '@/lib/pgn/PgnExporter';
import { defaultPgnTranslationProvider } from '@/lib/pgnComments/provider.ts';

type FileRef = { id: string; filename: string; pgnText: string };

type Props = {
  source: PgnCommentSource;
  files: FileRef[];
  selectedIds?: string[];
  showCatchupHint?: boolean;
  testID?: string;
};

export function fileTranslateLabel(
  status: ReturnType<typeof describePgnFileTranslation>['status'],
  t: (key: 'pgn.translateComments' | 'pgn.completeTranslation' | 'pgn.retryTranslation' | 'pgn.alreadyFrench') => string,
): string {
  if (status === 'failed') return t('pgn.retryTranslation');
  if (status === 'stale' || status === 'pending') return t('pgn.completeTranslation');
  if (status === 'ready' || status === 'manual' || status === 'none') return t('pgn.alreadyFrench');
  return t('pgn.translateComments');
}

export function PgnTranslationActions({
  source,
  files,
  selectedIds,
  showCatchupHint = true,
  testID = 'pgn-translation-actions',
}: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const { store, queue } = usePgnCommentTranslations();

  const selected = selectedIds?.length
    ? files.filter((f) => selectedIds.includes(f.id))
    : files;
  const pendingEnglish = files.reduce((sum, file) => {
    const info = describePgnFileTranslation(source, file.id, file.pgnText);
    return sum + (info.status === 'ready' || info.status === 'none' || info.status === 'manual' ? 0 : info.english);
  }, 0);
  const configured = defaultPgnTranslationProvider.configured;

  const run = async (targets: FileRef[]) => {
    await enqueueExistingPgns(
      targets.map((file) => ({ source, fileId: file.id, pgnText: file.pgnText })),
    );
  };

  const exportFile = (file: FileRef, mode: PgnExportMode) => {
    const units = collectPgnCommentUnits(file.pgnText, source, file.id);
    const pairs = units
      .map((unit) => {
        const rec = store.resolveFrench(unit.anchor, unit.original);
        if (!rec?.translatedText) return null;
        if (rec.status === 'stale') return null;
        return { original: unit.original, french: rec.translatedText };
      })
      .filter((row): row is { original: string; french: string } => !!row);
    downloadPgnFile(file.filename, applyFrenchToPgnText(file.pgnText, pairs, mode));
  };

  return (
    <View
      style={[styles.wrap, { borderColor: colors.border, backgroundColor: colors.card }]}
      testID={testID}
    >
      {!configured ? (
        <Text style={[styles.hint, { color: colors.mutedForeground }]} testID={`${testID}-unconfigured`}>
          {t('pgn.serviceNotConfigured')}
        </Text>
      ) : null}
      {showCatchupHint && pendingEnglish > 0 ? (
        <Text style={[styles.hint, { color: colors.mutedForeground }]} testID={`${testID}-catchup`}>
          {t('pgn.catchupHint')}
        </Text>
      ) : null}
      <Text style={[styles.progress, { color: colors.mutedForeground }]}>
        {t('pgn.batchProgress', {
          done: Math.max(0, queue.getSnapshot() ? Object.values(queue.getSnapshot().jobs).filter((j) => j.status === 'done').length : 0),
          total: Object.keys(queue.getSnapshot().jobs).length,
        })}
      </Text>
      <View style={styles.row}>
        <Action label={t('pgn.translateSelection')} onPress={() => void run(selected)} testID={`${testID}-selection`} />
        <Action
          label={t('pgn.translateAllExisting')}
          onPress={() => void run(files)}
          testID={`${testID}-all`}
        />
        <Action
          label={t('pgn.cancelBatch')}
          onPress={() => pgnTranslationQueue.cancel()}
          testID={`${testID}-cancel`}
        />
        <Action
          label={t('pgn.resumeBatch')}
          onPress={() => void pgnTranslationQueue.processNext()}
          testID={`${testID}-resume`}
        />
      </View>
      {files.length === 1 ? (
        <View style={styles.row}>
          <Action
            label={t('pgn.exportOriginal')}
            onPress={() => exportFile(files[0]!, 'original')}
            testID={`${testID}-export-original`}
          />
          <Action
            label={t('pgn.exportFrench')}
            onPress={() => exportFile(files[0]!, 'french')}
            testID={`${testID}-export-french`}
          />
          <Action
            label={t('pgn.exportBilingual')}
            onPress={() => exportFile(files[0]!, 'bilingual')}
            testID={`${testID}-export-bilingual`}
          />
        </View>
      ) : null}
    </View>
  );
}

function Action({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.btn, { borderColor: colors.border }]}
      testID={testID}
    >
      <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8, marginBottom: 12 },
  hint: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter_400Regular' },
  progress: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
});
