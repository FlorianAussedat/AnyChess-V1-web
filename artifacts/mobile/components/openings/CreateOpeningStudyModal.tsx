/**
 * Folder + name + start-vs-here flow to turn an AnyLyseur position into a PGN study.
 */
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { useRepertoireLibrary } from '@/hooks/useRepertoireLibrary';
import { FolderPickModal } from '@/components/openings/FolderPickModal';
import { NameModal } from '@/components/openings/NameModal';
import { OpeningChoiceModal } from '@/components/openings/OpeningChoiceModal';
import { RepertoireSidePicker } from '@/components/RepertoireSidePicker';
import {
  createOpeningStudySession,
  type OpeningEditorSession,
} from '@/lib/openingStudy';
import type { RepertoireSide } from '@/lib/repertoire';

type Step = 'folder' | 'create-folder' | 'name' | 'scope';

type Props = {
  visible: boolean;
  initialFen: string;
  currentFen: string;
  sansFromStart: readonly string[];
  onCancel: () => void;
  onCreated: (session: OpeningEditorSession, side: 'white' | 'black') => void;
};

export function CreateOpeningStudyModal({
  visible,
  initialFen,
  currentFen,
  sansFromStart,
  onCancel,
  onCreated,
}: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const { folders, createFolder, refresh } = useRepertoireLibrary();
  const [step, setStep] = useState<Step>('folder');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [folderSide, setFolderSide] = useState<'white' | 'black'>('white');
  const [nameDraft, setNameDraft] = useState('');
  const [createSide, setCreateSide] = useState<RepertoireSide | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const atStart = currentFen === initialFen && sansFromStart.length === 0;

  useEffect(() => {
    if (!visible) {
      setStep('folder');
      setFolderId(null);
      setFolderSide('white');
      setNameDraft('');
      setCreateSide(null);
      setBusy(false);
      setFormError(null);
      return;
    }
    setNameDraft(t('openings.newStudyDefault'));
    void refresh();
  }, [visible, t, refresh]);

  const finish = (scope: 'start' | 'here') => {
    if (!folderId) return;
    const displayName = nameDraft.trim() || t('openings.newStudyDefault');
    const session = createOpeningStudySession({
      folderId,
      displayName,
      initialFen: scope === 'start' ? initialFen : currentFen,
      sans: scope === 'start' ? sansFromStart : [],
    });
    onCreated(session, folderSide);
  };

  return (
    <>
      <FolderPickModal
        visible={visible && step === 'folder'}
        folders={folders}
        title={t('openings.pickFolderTitle')}
        busy={busy}
        onSelect={(id) => {
          const folder = folders.find((f) => f.id === id);
          setFolderId(id);
          setFolderSide(folder?.side === 'black' ? 'black' : 'white');
          setStep('name');
        }}
        onCreateFolder={() => {
          setFormError(null);
          setNameDraft('');
          setCreateSide(null);
          setStep('create-folder');
        }}
        onCancel={onCancel}
      />

      <NameModal
        visible={visible && step === 'create-folder'}
        title={t('openings.createFolder')}
        placeholder={t('openings.namePlaceholder')}
        value={nameDraft}
        onChangeText={setNameDraft}
        onCancel={() => {
          setStep('folder');
          setFormError(null);
        }}
        onSubmit={() => {
          void (async () => {
            if (!createSide) {
              setFormError(t('openings.sideRequired'));
              return;
            }
            setBusy(true);
            setFormError(null);
            try {
              const folder = await createFolder(nameDraft.trim(), createSide);
              setFolderId(folder.id);
              setFolderSide(createSide);
              setNameDraft(t('openings.newStudyDefault'));
              setStep('name');
            } catch (err) {
              setFormError(err instanceof Error ? err.message : String(err));
            } finally {
              setBusy(false);
            }
          })();
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

      <NameModal
        visible={visible && step === 'name'}
        title={t('openings.createStudyNameTitle')}
        placeholder={t('openings.newPgnNamePlaceholder')}
        value={nameDraft}
        onChangeText={setNameDraft}
        onCancel={() => {
          setStep('folder');
          setFolderId(null);
        }}
        onSubmit={() => {
          if (atStart) {
            finish('here');
            return;
          }
          setStep('scope');
        }}
        busy={busy}
        error={null}
        submitLabel={t('openings.annotatePgn')}
      />

      <OpeningChoiceModal
        visible={visible && step === 'scope'}
        title={t('openings.createStudyScopeTitle')}
        body={t('openings.createStudyScopeBody')}
        testID="opening-create-study-scope"
        actions={[
          {
            label: t('openings.createStudyFromStart'),
            testID: 'opening-create-study-from-start',
            primary: true,
            onPress: () => finish('start'),
          },
          {
            label: t('openings.createStudyFromPosition'),
            testID: 'opening-create-study-from-here',
            onPress: () => finish('here'),
          },
          {
            label: t('common.cancel'),
            testID: 'opening-create-study-scope-cancel',
            onPress: () => setStep('name'),
          },
        ]}
      />
    </>
  );
}
