import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useRepertoireLibrary } from '@/hooks/useRepertoireLibrary';
import type { StoredPgnFile } from '@/lib/repertoire';
import type { PlayerColor } from '@/contexts/GameContext';

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function FolderDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { folderId } = useLocalSearchParams<{ folderId: string }>();
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom;

  const {
    ready,
    getFolder,
    getFiles,
    importPgn,
    replacePgn,
    deletePgn,
  } = useRepertoireLibrary();

  const folder = folderId ? getFolder(folderId) : null;
  const files = useMemo(
    () => (folderId ? getFiles(folderId) : []),
    [folderId, getFiles],
  );

  const [importOpen, setImportOpen] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<StoredPgnFile | null>(null);
  const [detailFile, setDetailFile] = useState<StoredPgnFile | null>(null);
  const [playOpen, setPlayOpen] = useState(false);
  const [playColor, setPlayColor] = useState<PlayerColor>('w');
  const [filename, setFilename] = useState('lignes.pgn');
  const [pgnText, setPgnText] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [lastImportResult, setLastImportResult] = useState<StoredPgnFile | null>(null);

  const canPlay = files.some((f) => f.summary.parseSucceeded);

  const startPlay = useCallback(() => {
    if (!folderId || !canPlay) return;
    setPlayOpen(false);
    router.push(
      `/openings/play?folderId=${encodeURIComponent(folderId)}&color=${playColor}` as Href,
    );
  }, [folderId, canPlay, playColor, router]);

  const openImport = useCallback(() => {
    setFilename('lignes.pgn');
    setPgnText('');
    setFormError(null);
    setLastImportResult(null);
    setReplaceTarget(null);
    setImportOpen(true);
  }, []);

  const openReplace = useCallback((file: StoredPgnFile) => {
    setReplaceTarget(file);
    setFilename(file.filename);
    setPgnText(file.pgnText);
    setFormError(null);
    setLastImportResult(null);
    setImportOpen(true);
  }, []);

  const submitImport = useCallback(async () => {
    if (!folderId) return;
    setBusy(true);
    setFormError(null);
    try {
      let file: StoredPgnFile;
      if (replaceTarget) {
        file = await replacePgn(replaceTarget.id, pgnText, filename);
      } else {
        file = await importPgn(folderId, filename, pgnText);
      }
      setLastImportResult(file);
      if (file.summary.parseSucceeded) {
        // Keep modal open briefly so the user sees the summary, then close.
        setTimeout(() => {
          setImportOpen(false);
          setReplaceTarget(null);
          setLastImportResult(null);
        }, 900);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [folderId, filename, pgnText, replaceTarget, importPgn, replacePgn]);

  const confirmDeleteFile = useCallback(
    (file: StoredPgnFile) => {
      const message = `Retirer « ${file.filename} » de ce répertoire ? Le dossier lui-même sera conservé.`;
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.confirm(message)) {
          deletePgn(file.id).catch(() => {});
        }
        return;
      }
      Alert.alert('Retirer le fichier', message, [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: () => {
            deletePgn(file.id).catch(() => {});
          },
        },
      ]);
    },
    [deletePgn],
  );

  const onPickFileWeb = useCallback(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pgn,text/plain,application/x-chess-pgn';
    input.multiple = false;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        setFilename(file.name);
        setPgnText(text);
      } catch {
        setFormError('Impossible de lire le fichier.');
      }
    };
    input.click();
  }, []);

  if (!ready) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: topPad + 6 }]}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      </View>
    );
  }

  if (!folder) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: topPad + 6 }]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
          >
            <Ionicons name="chevron-back" size={20} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.title, { color: colors.foreground }]}>Dossier introuvable</Text>
        </View>
      </View>
    );
  }

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
        >
          <Ionicons name="chevron-back" size={20} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
            {folder.name}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {files.length} fichier{files.length !== 1 ? 's' : ''} PGN
          </Text>
        </View>
        <Pressable
          onPress={openImport}
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, opacity: pressed ? 0.75 : 1 },
          ]}
          testID="import-pgn-btn"
        >
          <Ionicons name="cloud-upload-outline" size={16} color={colors.foreground} />
          <Text style={[styles.primaryBtnLabel, { color: colors.foreground }]}>
            Importer
          </Text>
        </Pressable>
        <Pressable
          onPress={() => canPlay && setPlayOpen(true)}
          disabled={!canPlay}
          style={({ pressed }) => [
            styles.primaryBtn,
            {
              backgroundColor: canPlay ? colors.primary : colors.muted,
              opacity: !canPlay ? 0.45 : pressed ? 0.75 : 1,
            },
          ]}
          testID="play-opening-btn"
        >
          <Ionicons name="play" size={16} color={canPlay ? colors.primaryForeground : colors.mutedForeground} />
          <Text
            style={[
              styles.primaryBtnLabel,
              { color: canPlay ? colors.primaryForeground : colors.mutedForeground },
            ]}
          >
            Jouer
          </Text>
        </Pressable>
      </View>

      <Text style={[styles.hint, { color: colors.mutedForeground }]}>
        Plusieurs PGN dans ce dossier seront fusionnés en un seul arbre de répertoire
        (transpositions reconnues, doublons évités).
      </Text>

      {files.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="document-outline" size={44} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Aucun PGN importé
          </Text>
          <Text style={[styles.emptyMsg, { color: colors.mutedForeground }]}>
            Importe un ou plusieurs fichiers .pgn (collage ou sélection de fichier).
          </Text>
        </View>
      ) : (
        <FlatList
          data={files}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View
              style={[styles.fileCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Pressable
                onPress={() => setDetailFile(item)}
                style={styles.fileMain}
                testID={`pgn-file-${item.id}`}
              >
                <View style={styles.fileHeader}>
                  <Ionicons
                    name={item.summary.parseSucceeded ? 'document-text-outline' : 'warning-outline'}
                    size={20}
                    color={item.summary.parseSucceeded ? colors.primary : '#F5A623'}
                  />
                  <Text style={[styles.fileName, { color: colors.foreground }]} numberOfLines={1}>
                    {item.filename}
                  </Text>
                </View>
                <Text style={[styles.fileMeta, { color: colors.mutedForeground }]}>
                  Importé le {formatDate(item.importedAt)}
                </Text>
                <Text style={[styles.fileMeta, { color: colors.mutedForeground }]}>
                  {item.summary.gameCount} partie{item.summary.gameCount !== 1 ? 's' : ''}
                  {' · '}
                  {item.summary.positionCount} position{item.summary.positionCount !== 1 ? 's' : ''}
                  {item.summary.errors.length > 0
                    ? ` · ${item.summary.errors.length} erreur${item.summary.errors.length > 1 ? 's' : ''}`
                    : ''}
                </Text>
                <Text
                  style={[
                    styles.fileStatus,
                    {
                      color: item.summary.parseSucceeded
                        ? '#27AE60'
                        : colors.destructive,
                    },
                  ]}
                >
                  {item.summary.parseSucceeded
                    ? item.summary.errors.length > 0
                      ? 'Import partiel'
                      : 'Import réussi'
                    : 'Échec d’import'}
                </Text>
              </Pressable>
              <View style={styles.fileActions}>
                <Pressable
                  onPress={() => openReplace(item)}
                  hitSlop={8}
                  style={styles.iconOnly}
                  testID={`replace-pgn-${item.id}`}
                >
                  <Ionicons name="swap-horizontal-outline" size={18} color={colors.mutedForeground} />
                </Pressable>
                <Pressable
                  onPress={() => confirmDeleteFile(item)}
                  hitSlop={8}
                  style={styles.iconOnly}
                  testID={`delete-pgn-${item.id}`}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      {/* Import / replace modal */}
      <Modal
        visible={importOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setImportOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.border, maxHeight: '90%' },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {replaceTarget ? 'Remplacer le PGN' : 'Importer un PGN'}
            </Text>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
              Nom du fichier
            </Text>
            <TextInput
              value={filename}
              onChangeText={setFilename}
              placeholder="lignes.pgn"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.modalInput,
                {
                  backgroundColor: colors.input,
                  color: colors.foreground,
                  borderColor: colors.border,
                },
              ]}
              editable={!busy}
            />

            <View style={styles.pgnHeaderRow}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                Contenu PGN
              </Text>
              {isWeb && (
                <Pressable onPress={onPickFileWeb} hitSlop={6}>
                  <Text style={{ color: colors.primary, fontFamily: 'Inter_500Medium', fontSize: 12 }}>
                    Choisir un fichier…
                  </Text>
                </Pressable>
              )}
            </View>
            <TextInput
              value={pgnText}
              onChangeText={setPgnText}
              placeholder={'[Event "…"]\n1. e4 e5 2. Nf3 …'}
              placeholderTextColor={colors.mutedForeground}
              multiline
              textAlignVertical="top"
              style={[
                styles.pgnInput,
                {
                  backgroundColor: colors.input,
                  color: colors.foreground,
                  borderColor: colors.border,
                },
              ]}
              editable={!busy}
            />

            {!!formError && (
              <Text style={[styles.modalError, { color: colors.destructive }]}>{formError}</Text>
            )}

            {lastImportResult && (
              <View
                style={[
                  styles.resultBox,
                  {
                    borderColor: lastImportResult.summary.parseSucceeded
                      ? '#27AE60'
                      : colors.destructive,
                  },
                ]}
              >
                <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium', fontSize: 13 }}>
                  {lastImportResult.summary.parseSucceeded
                    ? `Importé : ${lastImportResult.summary.gameCount} partie(s), ${lastImportResult.summary.positionCount} position(s)`
                    : 'Aucune position valide importée'}
                </Text>
                {lastImportResult.summary.errors.slice(0, 3).map((err, i) => (
                  <Text
                    key={i}
                    style={{ color: colors.destructive, fontSize: 11, fontFamily: 'Inter_400Regular' }}
                  >
                    • {err.message}
                  </Text>
                ))}
              </View>
            )}

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setImportOpen(false);
                  setReplaceTarget(null);
                }}
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
                onPress={submitImport}
                disabled={busy || !pgnText.trim()}
                style={({ pressed }) => [
                  styles.modalBtn,
                  {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                    opacity: pressed || busy || !pgnText.trim() ? 0.6 : 1,
                  },
                ]}
                testID="confirm-import-btn"
              >
                <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold' }}>
                  {busy ? 'Analyse…' : replaceTarget ? 'Remplacer' : 'Importer'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Play setup modal */}
      <Modal
        visible={playOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPlayOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Lancer une partie
            </Text>
            <Text style={[styles.fileMeta, { color: colors.mutedForeground }]}>
              Répertoire : {folder.name}
            </Text>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 8 }]}>
              Tu joues
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['w', 'b'] as PlayerColor[]).map((c) => {
                const active = playColor === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setPlayColor(c)}
                    style={[
                      {
                        flex: 1,
                        height: 40,
                        borderRadius: 10,
                        borderWidth: 1,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: active ? colors.primary : colors.input,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontFamily: 'Inter_600SemiBold',
                        fontSize: 14,
                        color: active ? colors.primaryForeground : colors.foreground,
                      }}
                    >
                      {c === 'w' ? '♔ Blancs' : '♚ Noirs'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.fileMeta, { color: colors.mutedForeground, marginTop: 4 }]}>
              L’échiquier s’oriente selon ta couleur. Les Blancs jouent toujours en premier.
              L’adversaire suit le répertoire tant que tu restes dans la théorie.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setPlayOpen(false)}
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
                onPress={startPlay}
                style={({ pressed }) => [
                  styles.modalBtn,
                  {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                testID="confirm-play-btn"
              >
                <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold' }}>
                  Commencer
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* File detail modal (errors list) */}
      <Modal
        visible={detailFile != null}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailFile(null)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.border, maxHeight: '85%' },
            ]}
          >
            {detailFile && (
              <>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  {detailFile.filename}
                </Text>
                <ScrollView style={{ maxHeight: 360 }}>
                  <Text style={[styles.fileMeta, { color: colors.mutedForeground }]}>
                    Importé le {formatDate(detailFile.importedAt)}
                  </Text>
                  <Text style={[styles.fileMeta, { color: colors.mutedForeground, marginTop: 6 }]}>
                    Parties / chapitres : {detailFile.summary.gameCount}
                  </Text>
                  <Text style={[styles.fileMeta, { color: colors.mutedForeground }]}>
                    Positions parsées : {detailFile.summary.positionCount}
                  </Text>
                  <Text style={[styles.fileMeta, { color: colors.mutedForeground }]}>
                    Branches : {detailFile.summary.branchCount}
                  </Text>
                  <Text
                    style={[
                      styles.fileStatus,
                      {
                        marginTop: 8,
                        color: detailFile.summary.parseSucceeded ? '#27AE60' : colors.destructive,
                      },
                    ]}
                  >
                    {detailFile.summary.parseSucceeded
                      ? detailFile.summary.errors.length > 0
                        ? 'Import partiel — certaines lignes rejetées'
                        : 'Import réussi'
                      : 'Échec d’import'}
                  </Text>

                  {detailFile.summary.errors.length > 0 && (
                    <View style={{ marginTop: 12, gap: 4 }}>
                      <Text style={[styles.fieldLabel, { color: colors.destructive }]}>
                        Erreurs ({detailFile.summary.errors.length})
                      </Text>
                      {detailFile.summary.errors.map((err, i) => (
                        <Text
                          key={i}
                          style={{
                            color: colors.foreground,
                            fontSize: 12,
                            fontFamily: 'Inter_400Regular',
                            lineHeight: 17,
                          }}
                        >
                          • {err.message}
                          {err.context ? ` (« ${err.context} »)` : ''}
                        </Text>
                      ))}
                    </View>
                  )}

                  {detailFile.summary.warnings.length > 0 && (
                    <View style={{ marginTop: 12, gap: 4 }}>
                      <Text style={[styles.fieldLabel, { color: '#F5A623' }]}>
                        Avertissements ({detailFile.summary.warnings.length})
                      </Text>
                      {detailFile.summary.warnings.map((w, i) => (
                        <Text
                          key={i}
                          style={{
                            color: colors.foreground,
                            fontSize: 12,
                            fontFamily: 'Inter_400Regular',
                          }}
                        >
                          • {w.message}
                        </Text>
                      ))}
                    </View>
                  )}
                </ScrollView>
                <View style={styles.modalActions}>
                  <Pressable
                    onPress={() => setDetailFile(null)}
                    style={({ pressed }) => [
                      styles.modalBtn,
                      {
                        backgroundColor: colors.primary,
                        borderColor: colors.primary,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold' }}>
                      Fermer
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 14,
    gap: 10,
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
  hint: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 17,
    paddingHorizontal: 2,
  },
  list: {
    gap: 10,
    paddingBottom: 24,
  },
  fileCard: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  fileMain: {
    flex: 1,
    gap: 3,
  },
  fileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fileName: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  fileMeta: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  fileStatus: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 2,
  },
  fileActions: {
    justifyContent: 'center',
    gap: 10,
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
    padding: 18,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  fieldLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pgnHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalInput: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  pgnInput: {
    minHeight: 160,
    maxHeight: 260,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'Inter_400Regular',
  },
  modalError: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  resultBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  modalBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
});
