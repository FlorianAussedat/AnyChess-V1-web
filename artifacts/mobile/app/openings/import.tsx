/**
 * Opening PGN import — same panel as game analyses, without FEN.
 * Saves into the openings “À classer” folder (not the game library).
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
import { MAX_OPENINGS_PGN_IMPORT_BATCH } from '@/lib/gameLibrary';
import { repertoireService } from '@/lib/repertoire';

export default function OpeningsImportScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useAppSafeInsets();
  const router = useRouter();

  const onLoad = useCallback(
    async (payload: PgnImportPayload) => {
      if (payload.kind === 'fen') {
        throw new Error(t('parties.pgnInvalid'));
      }
      if (payload.games.length === 0) {
        throw new Error(t('parties.pgnInvalid'));
      }
      const folderId = await repertoireService.getUnfiledFolderId();
      for (const game of payload.games) {
        if (!game.pgnText.trim()) throw new Error(t('parties.pgnInvalid'));
        const filename = game.filename?.trim() || 'opening.pgn';
        await repertoireService.importPgn(
          folderId,
          filename,
          game.pgnText,
          game.displayName,
        );
      }
      router.replace('/openings/manage' as Href);
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
      testID="openings-import-screen"
    >
      <ScreenHeader
        onBack={() => router.back()}
        title={t('openings.importTitle')}
        titleNumberOfLines={2}
        backTestID="openings-import-back"
      />
      <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 18 }}>
        {t('pgn.importNotice')}
      </Text>
      <PgnImportPanel
        allowFen={false}
        maxGameSelection={MAX_OPENINGS_PGN_IMPORT_BATCH}
        onLoad={onLoad}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: DesignTokens.spacing.screenX,
    gap: 14,
  },
});
