import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useRepertoireLibrary } from '@/hooks/useRepertoireLibrary';
import type { RepertoireFolder } from '@/lib/repertoire';
import { sideLabel } from '@/components/RepertoireSidePicker';

export default function OpeningsFolderList() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom;

  const {
    ready,
    folders,
    error,
    createFolder,
    renameFolder,
    deleteFolder,
    getFiles,
    getTrainableFolders,
  } = useRepertoireLibrary();

  const trainable = getTrainableFolders();
  const [mixedSelect, setMixedSelect] = useState<Set<string>>(new Set());
  const [mixedOpen, setMixedOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<RepertoireFolder | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = useCallback(() => {
    setNameDraft('');
    setFormError(null);
    setCreateOpen(true);
  }, []);

  const openRename = useCallback((folder: RepertoireFolder) => {
    setRenameTarget(folder);
    setNameDraft(folder.name);
    setFormError(null);
  }, []);

  const submitCreate = useCallback(async () => {
    setBusy(true);
    setFormError(null);
    try {
      await createFolder(nameDraft);
      setCreateOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [createFolder, nameDraft]);

  const submitRename = useCallback(async () => {
    if (!renameTarget) return;
    setBusy(true);
    setFormError(null);
    try {
      await renameFolder(renameTarget.id, nameDraft);
      setRenameTarget(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [renameFolder, renameTarget, nameDraft]);

  const toggleMixedFolder = useCallback((folderId: string) => {
    setMixedSelect((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }, []);

  const selectAllTrainable = useCallback(() => {
    setMixedSelect(new Set(trainable.map((f) => f.id)));
  }, [trainable]);

  const startMixedContinue = useCallback(() => {
    const ids = [...mixedSelect];
    if (ids.length === 0) return;
    setMixedOpen(false);
    router.push(
      `/openings/continue?folderIds=${encodeURIComponent(ids.join(','))}` as Href,
    );
  }, [mixedSelect, router]);

  const confirmDelete = useCallback(
    (folder: RepertoireFolder) => {
      const fileCount = getFiles(folder.id).length;
      const message =
        fileCount > 0
          ? `Supprimer « ${folder.name} » et ses ${fileCount} fichier${fileCount > 1 ? 's' : ''} PGN ? Cette action est irréversible.`
          : `Supprimer le dossier « ${folder.name} » ?`;

      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.confirm(message)) {
          deleteFolder(folder.id).catch(() => {});
        }
        return;
      }

      Alert.alert('Supprimer le dossier', message, [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            deleteFolder(folder.id).catch(() => {});
          },
        },
      ]);
    },
    [deleteFolder, getFiles],
  );

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingTop: topPad + 6,
          paddingBottom: bottomPad + 6,
        },
      ]}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [
            styles.iconBtn,
            { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.6 : 1 },
          ]}
          testID="openings-back"
        >
          <Ionicons name="chevron-back" size={20} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Ouvertures</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Répertoires PGN
          </Text>
        </View>
        <Pressable
          onPress={openCreate}
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.75 : 1 },
          ]}
          testID="create-folder-btn"
        >
          <Ionicons name="add" size={18} color={colors.primaryForeground} />
          <Text style={[styles.primaryBtnLabel, { color: colors.primaryForeground }]}>
            Nouveau
          </Text>
        </Pressable>
      </View>

      {trainable.length > 0 && (
        <View style={[styles.mixedBlock, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.mixedTitle, { color: colors.foreground }]}>
            Entraînement mixte
          </Text>
          <Text style={[styles.mixedHint, { color: colors.mutedForeground }]}>
            Combine plusieurs répertoires — l’orientation change selon le côté de chaque ligne.
          </Text>
          <Pressable
            onPress={() => {
              if (mixedSelect.size === 0) selectAllTrainable();
              setMixedOpen(true);
            }}
            style={({ pressed }) => [
              styles.mixedBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.75 : 1 },
            ]}
            testID="mixed-training-btn"
          >
            <Ionicons name="shuffle-outline" size={18} color={colors.primaryForeground} />
            <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold' }}>
              Continue la ligne (mixte)
            </Text>
          </Pressable>
        </View>
      )}

      {!ready ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={[styles.emptyTitle, { color: colors.destructive }]}>{error}</Text>
        </View>
      ) : folders.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="folder-open-outline" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Aucun répertoire
          </Text>
          <Text style={[styles.emptyMsg, { color: colors.mutedForeground }]}>
            Crée un dossier (ex. Dragon accéléré, Caro-Kann) puis importe tes fichiers PGN.
          </Text>
        </View>
      ) : (
        <FlatList
          data={folders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const files = getFiles(item.id);
            return (
              <Pressable
                onPress={() => router.push(`/openings/${item.id}` as Href)}
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
                testID={`folder-${item.id}`}
              >
                <View style={[styles.folderIcon, { backgroundColor: colors.primary }]}>
                  <Ionicons name="folder" size={22} color={colors.primaryForeground} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.name}</Text>
                  <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>
                    {files.length === 0
                      ? 'Aucun fichier PGN'
                      : `${files.length} fichier${files.length > 1 ? 's' : ''} PGN`}
                    {item.side ? ` · ${sideLabel(item.side)}` : ''}
                  </Text>
                </View>
                <Pressable
                  onPress={() => openRename(item)}
                  hitSlop={8}
                  style={styles.iconOnly}
                  testID={`rename-folder-${item.id}`}
                >
                  <Ionicons name="pencil-outline" size={18} color={colors.mutedForeground} />
                </Pressable>
                <Pressable
                  onPress={() => confirmDelete(item)}
                  hitSlop={8}
                  style={styles.iconOnly}
                  testID={`delete-folder-${item.id}`}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                </Pressable>
                <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
              </Pressable>
            );
          }}
        />
      )}

      <NameModal
        visible={createOpen}
        title="Nouveau répertoire"
        placeholder="Ex. Dragon accéléré"
        value={nameDraft}
        onChangeText={setNameDraft}
        onCancel={() => setCreateOpen(false)}
        onSubmit={submitCreate}
        busy={busy}
        error={formError}
        submitLabel="Créer"
      />

      <NameModal
        visible={renameTarget != null}
        title="Renommer le répertoire"
        placeholder="Nouveau nom"
        value={nameDraft}
        onChangeText={setNameDraft}
        onCancel={() => setRenameTarget(null)}
        onSubmit={submitRename}
        busy={busy}
        error={formError}
        submitLabel="Enregistrer"
      />

      <Modal visible={mixedOpen} transparent animationType="fade" onRequestClose={() => setMixedOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Répertoires à mélanger
            </Text>
            <Pressable onPress={selectAllTrainable} hitSlop={8}>
              <Text style={{ color: colors.primary, fontFamily: 'Inter_500Medium', fontSize: 12 }}>
                Tout sélectionner
              </Text>
            </Pressable>
            <View style={{ gap: 8, maxHeight: 280 }}>
              {trainable.map((folder) => {
                const selected = mixedSelect.has(folder.id);
                return (
                  <Pressable
                    key={folder.id}
                    onPress={() => toggleMixedFolder(folder.id)}
                    style={[
                      styles.mixedRow,
                      {
                        borderColor: colors.border,
                        backgroundColor: selected ? colors.input : colors.card,
                      },
                    ]}
                  >
                    <Ionicons
                      name={selected ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={selected ? colors.primary : colors.mutedForeground}
                    />
                    <Text style={{ flex: 1, color: colors.foreground, fontFamily: 'Inter_500Medium' }}>
                      {folder.name}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                      {folder.side ? sideLabel(folder.side) : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setMixedOpen(false)}
                style={({ pressed }) => [
                  styles.modalBtn,
                  { borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}>
                  Annuler
                </Text>
              </Pressable>
              <Pressable
                onPress={startMixedContinue}
                disabled={mixedSelect.size === 0}
                style={({ pressed }) => [
                  styles.modalBtn,
                  {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                    opacity: pressed || mixedSelect.size === 0 ? 0.6 : 1,
                  },
                ]}
              >
                <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold' }}>
                  Commencer
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Shared name modal ───────────────────────────────────────────────────────

interface NameModalProps {
  visible: boolean;
  title: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  busy: boolean;
  error: string | null;
  submitLabel: string;
}

function NameModal({
  visible,
  title,
  placeholder,
  value,
  onChangeText,
  onCancel,
  onSubmit,
  busy,
  error,
  submitLabel,
}: NameModalProps) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>{title}</Text>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={colors.mutedForeground}
            autoFocus
            style={[
              styles.modalInput,
              {
                backgroundColor: colors.input,
                color: colors.foreground,
                borderColor: colors.border,
              },
            ]}
            onSubmitEditing={onSubmit}
            editable={!busy}
          />
          {!!error && (
            <Text style={[styles.modalError, { color: colors.destructive }]}>{error}</Text>
          )}
          <View style={styles.modalActions}>
            <Pressable
              onPress={onCancel}
              disabled={busy}
              style={({ pressed }) => [
                styles.modalBtn,
                { borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}>
                Annuler
              </Text>
            </Pressable>
            <Pressable
              onPress={onSubmit}
              disabled={busy || !value.trim()}
              style={({ pressed }) => [
                styles.modalBtn,
                {
                  backgroundColor: colors.primary,
                  borderColor: colors.primary,
                  opacity: pressed || busy || !value.trim() ? 0.6 : 1,
                },
              ]}
            >
              <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold' }}>
                {busy ? '…' : submitLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 14,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  subtitle: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  primaryBtnLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  list: {
    gap: 10,
    paddingBottom: 20,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  folderIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  cardMeta: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  iconOnly: {
    padding: 4,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 28,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  emptyMsg: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 19,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  modalInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  modalError: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modalBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  mixedBlock: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  mixedTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  mixedHint: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 17,
  },
  mixedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
  },
  mixedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
});
