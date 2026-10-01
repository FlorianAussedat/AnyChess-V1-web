import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { usePgnCommentTranslations } from '@/hooks/usePgnCommentTranslations';
import {
  resolvePgnComment,
  type CommentDisplayMode,
  type PgnCommentAnchor,
  type PgnCommentSource,
} from '@/lib/pgnComments';

type Props = {
  original: string;
  source: PgnCommentSource;
  fileId: string;
  gameIndex?: number;
  nodeId: string;
  slot?: PgnCommentAnchor['slot'];
  emptyLabel?: string;
  testID?: string;
  renderText?: (text: string) => React.ReactNode;
};

export function PgnCommentPane({
  original,
  source,
  fileId,
  gameIndex = 0,
  nodeId,
  slot = 'after',
  emptyLabel,
  testID,
  renderText,
}: Props) {
  const colors = useColors();
  const { t, language } = useTranslation();
  usePgnCommentTranslations();
  const [mode, setMode] = useState<CommentDisplayMode>('auto');

  const resolved = useMemo(
    () =>
      resolvePgnComment(
        { source, fileId, gameIndex, nodeId, slot },
        original,
        language,
        mode,
      ),
    [fileId, gameIndex, language, mode, nodeId, original, slot, source],
  );

  if (!original.trim()) {
    return emptyLabel ? (
      <Text style={[styles.empty, { color: colors.mutedForeground }]} testID={testID}>
        {emptyLabel}
      </Text>
    ) : null;
  }

  const statusLabel =
    resolved.status === 'pending'
      ? t('pgn.translationPending')
      : resolved.status === 'stale'
        ? t('pgn.translationPartial')
        : resolved.status === 'unavailable'
          ? t('pgn.translationUnavailable')
          : resolved.status === 'manual'
            ? t('pgn.commentFrench')
            : null;

  return (
    <View testID={testID}>
      <View style={styles.toggleRow}>
        <Pressable
          onPress={() => setMode('original')}
          style={[
            styles.chip,
            {
              borderColor: resolved.showing === 'original' ? colors.primary : colors.border,
              backgroundColor:
                resolved.showing === 'original' ? colors.secondary : colors.card,
            },
          ]}
          testID={testID ? `${testID}-original` : undefined}
        >
          <Text style={{ color: colors.foreground }}>{t('pgn.commentOriginal')}</Text>
        </Pressable>
        <Pressable
          onPress={() => setMode('french')}
          style={[
            styles.chip,
            {
              borderColor: resolved.showing === 'french' ? colors.primary : colors.border,
              backgroundColor: resolved.showing === 'french' ? colors.secondary : colors.card,
            },
          ]}
          testID={testID ? `${testID}-french` : undefined}
        >
          <Text style={{ color: colors.foreground }}>{t('pgn.commentFrench')}</Text>
        </Pressable>
      </View>
      {statusLabel ? (
        <Text style={[styles.status, { color: colors.mutedForeground }]}>{statusLabel}</Text>
      ) : null}
      {renderText ? (
        renderText(resolved.text)
      ) : (
        <Text style={[styles.body, { color: colors.foreground }]}>{resolved.text}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  status: { fontSize: 12, marginBottom: 6, fontFamily: 'Inter_400Regular' },
  body: { fontSize: 16, lineHeight: 24, fontFamily: 'Inter_400Regular' },
  empty: { fontSize: 15, lineHeight: 22, fontFamily: 'Inter_400Regular' },
});
