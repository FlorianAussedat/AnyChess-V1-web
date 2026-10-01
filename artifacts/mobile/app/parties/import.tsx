/**
 * Dedicated PGN/FEN import — loads into AnyLyseur without saving the library.
 */
import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PgnImportPanel, type PgnImportPayload } from '@/components/library/PgnImportPanel';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import { parseReaderPgn } from '@/lib/gameReader';
import {
  ANALYZER_DRAFT_HANDOFF,
  setParkedAnalyzerDraft,
} from '@/lib/gameLibrary/parkedAnalyzerDraft';

export default function PartiesImportScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useAppSafeInsets();
  const router = useRouter();

  const onLoad = useCallback(
    async (payload: PgnImportPayload) => {
      if (payload.kind === 'fen') {
        setParkedAnalyzerDraft({
          fen: payload.fen,
          tab: 'analysis',
        });
      } else {
        const game = payload.games[0];
        if (!game) throw new Error(t('parties.pgnInvalid'));
        const parsed = parseReaderPgn(game.pgnText, { allowEmptyMoves: true });
        if (!parsed.ok) throw new Error(t('parties.pgnInvalid'));
        setParkedAnalyzerDraft({
          pgnText: game.pgnText,
          displayName: game.displayName,
          tab: 'analysis',
        });
      }
      router.replace({
        pathname: '/parties/analyzer',
        params: { draft: ANALYZER_DRAFT_HANDOFF, tab: 'analysis' },
      } as Href);
    },
    [router, t],
  );

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.root,
        {
          paddingTop: insets.contentTop,
          paddingBottom: insets.contentBottom + 24,
        },
      ]}
      testID="parties-import-screen"
    >
      <ScreenHeader
        onBack={() => router.back()}
        title={t('parties.importTitle')}
        titleNumberOfLines={2}
        backTestID="parties-import-back"
      />
      <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 18 }}>
        {t('pgn.importNotice')}
      </Text>
      <PgnImportPanel allowFen maxGameSelection={1} onLoad={onLoad} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: DesignTokens.spacing.screenX,
    gap: 14,
  },
});
