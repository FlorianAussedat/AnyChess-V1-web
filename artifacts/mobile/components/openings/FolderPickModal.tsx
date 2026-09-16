/**
 * Pick an openings repertoire folder (or create one first).
 * Used by root PGN import and Bibliothèque → Ouvertures bridge.
 */
import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import type { RepertoireFolder } from '@/lib/repertoire';
import { sideLabel } from '@/components/RepertoireSidePicker';

type Props = {
  visible: boolean;
  folders: RepertoireFolder[];
  title?: string;
  /** Exclude this folder id (e.g. when moving within the same folder). */
  excludeFolderId?: string | null;
  busy?: boolean;
  onSelect: (folderId: string) => void;
  onCreateFolder: () => void;
  onCancel: () => void;
};

export function FolderPickModal({
  visible,
  folders,
  title,
  excludeFolderId,
  busy = false,
  onSelect,
  onCreateFolder,
  onCancel,
}: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const list = folders.filter((f) => f.id !== excludeFolderId);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          testID="openings-folder-pick"
        >
          <Text style={[styles.title, { color: colors.foreground }]}>
            {title ?? t('openings.pickFolderTitle')}
          </Text>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            {t('openings.pickFolderHint')}
          </Text>

          {list.length === 0 ? (
            <Text style={[styles.empty, { color: colors.mutedForeground }]}>
              {t('openings.pickFolderEmpty')}
            </Text>
          ) : (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {list.map((folder) => (
                <Pressable
                  key={folder.id}
                  testID={`openings-folder-pick-${folder.id}`}
                  disabled={busy}
                  onPress={() => onSelect(folder.id)}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.secondary,
                      opacity: pressed || busy ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[styles.rowTitle, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {folder.name}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                    {folder.side ? sideLabel(folder.side) : t('openings.sectionUnassigned')}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              disabled={busy}
              style={[styles.btn, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.foreground }}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              testID="openings-folder-pick-create"
              onPress={onCreateFolder}
              disabled={busy}
              style={[
                styles.btnPrimary,
                { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 },
              ]}
            >
              <Text style={{ color: colors.primaryForeground }}>
                {t('openings.createFolder')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    maxHeight: '85%',
  },
  title: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  hint: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  empty: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    paddingVertical: 16,
  },
  list: { maxHeight: 320 },
  row: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 6,
    gap: 2,
  },
  rowTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  btn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  btnPrimary: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});
