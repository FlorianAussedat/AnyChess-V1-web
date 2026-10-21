/**
 * Opening PGN import — same panel as game analyses, without FEN.
 * Destination defaults to the system folder « À classer » and can be any
 * folder in the tree, including a nested one.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PgnImportPanel, type PgnImportPayload } from '@/components/library/PgnImportPanel';
import { FolderPickModal } from '@/components/openings/FolderPickModal';
import { NameModal } from '@/components/openings/NameModal';
import { GuestLibraryLock } from '@/components/openings/GuestLibraryLock';
import { RepertoireSidePicker } from '@/components/RepertoireSidePicker';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useColors } from '@/hooks/useColors';
import { useRepertoireLibrary } from '@/hooks/useRepertoireLibrary';
import { usePersonalPgnAccess } from '@/hooks/usePersonalPgnAccess';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import { MAX_OPENINGS_PGN_IMPORT_BATCH } from '@/lib/gameLibrary';
import {
  isUnfiledOpeningFolder,
  repertoireService,
  type RepertoireSide,
} from '@/lib/repertoire';
import { loadExpandedFolderIds, saveExpandedFolderIds } from '@/lib/repertoire/folderTreeExpanded';

export default function OpeningsImportScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useAppSafeInsets();
  const router = useRouter();
  const { folders, importPgn, createFolder } = useRepertoireLibrary();
  const access = usePersonalPgnAccess();
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSide, setCreateSide] = useState<RepertoireSide | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!access.signedIn) return;
    let cancelled = false;
    void repertoireService.getUnfiledFolderId().then((id) => {
      if (!cancelled) setDestinationId((current) => current ?? id);
    });
    return () => {
      cancelled = true;
    };
  }, [access.signedIn]);

  const destination = folders.find((folder) => folder.id === destinationId) ?? null;
  const destinationLabel = !destination
    ? t('openings.toClassify')
    : isUnfiledOpeningFolder(destination)
      ? t('openings.toClassify')
      : destination.name;

  const revealFolder = useCallback(async (folderId: string) => {
    const known = repertoireService.getFolders();
    const ids = new Set(await loadExpandedFolderIds());
    const guard = new Set<string>();
    let current = known.find((folder) => folder.id === folderId);
    while (current && !guard.has(current.id)) {
      guard.add(current.id);
      ids.add(current.id);
      const parentId = current.parentId ?? null;
      current = parentId ? known.find((folder) => folder.id === parentId) : undefined;
    }
    await saveExpandedFolderIds([...ids]);
  }, []);

  const onLoad = useCallback(
    async (payload: PgnImportPayload) => {
      if (payload.kind === 'fen') {
        throw new Error(t('parties.pgnInvalid'));
      }
      if (payload.games.length === 0) {
        throw new Error(t('parties.pgnInvalid'));
      }
      const folderId = destinationId ?? (await repertoireService.getUnfiledFolderId());
      for (const game of payload.games) {
        if (!game.pgnText.trim()) throw new Error(t('parties.pgnInvalid'));
        const filename = game.filename?.trim() || 'opening.pgn';
        await importPgn(folderId, filename, game.pgnText, game.displayName);
      }
      await revealFolder(folderId);
      router.replace('/openings/manage' as Href);
    },
    [destinationId, importPgn, revealFolder, router, t],
  );

  const submitCreate = useCallback(async () => {
    if (!createSide) {
      setFormError(t('openings.sideRequired'));
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const folder = await createFolder(nameDraft, createSide, true, null);
      setDestinationId(folder.id);
      setCreateOpen(false);
      setNameDraft('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [createFolder, createSide, nameDraft, t]);

  if (access.ready && access.locked) {
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
            title={t('openings.importTitle')}
          titleNumberOfLines={2}
          backTestID="openings-import-back"
        />
        <GuestLibraryLock />
      </ScrollView>
    );
  }

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
        title={t('openings.importTitle')}
        titleNumberOfLines={2}
        backTestID="openings-import-back"
      />
      <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 18 }}>
        {t('pgn.importNotice')}
      </Text>
      <Pressable
        testID="openings-import-destination"
        accessibilityRole="button"
        onPress={() => setPickOpen(true)}
        style={({ pressed }) => [
          styles.destination,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Text style={[styles.destinationLabel, { color: colors.mutedForeground }]}>
          {t('openings.importDestination')}
        </Text>
        <Text style={[styles.destinationName, { color: colors.foreground }]} numberOfLines={2}>
          {destinationLabel}
        </Text>
      </Pressable>
      <PgnImportPanel
        allowFen={false}
        maxGameSelection={MAX_OPENINGS_PGN_IMPORT_BATCH}
        onLoad={onLoad}
      />
      <FolderPickModal
        visible={pickOpen}
        folders={folders}
        title={t('openings.importDestination')}
        onSelect={(folderId) => {
          setDestinationId(folderId);
          setPickOpen(false);
        }}
        onCreateFolder={() => {
          setPickOpen(false);
          setNameDraft('');
          setCreateSide(null);
          setFormError(null);
          setCreateOpen(true);
        }}
        onCancel={() => setPickOpen(false)}
      />
      <NameModal
        visible={createOpen}
        title={t('openings.newRepertoire')}
        placeholder={t('openings.namePlaceholder')}
        value={nameDraft}
        onChangeText={setNameDraft}
        onCancel={() => {
          setCreateOpen(false);
          setPickOpen(true);
        }}
        onSubmit={() => {
          void submitCreate();
        }}
        busy={busy}
        error={formError}
        submitLabel={t('openings.create')}
      >
        <View style={{ gap: 8, marginBottom: 8 }}>
          <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: 'Inter_500Medium' }}>
            {t('openings.setSide')}
          </Text>
          <RepertoireSidePicker value={createSide} onChange={setCreateSide} />
        </View>
      </NameModal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: DesignTokens.spacing.screenX,
    gap: 14,
  },
  destination: {
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 2,
    justifyContent: 'center',
  },
  destinationLabel: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  destinationName: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
