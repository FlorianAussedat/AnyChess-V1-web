import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useBoardCoordinates } from '@/hooks/useBoardCoordinates';
import { usePreferences } from '@/hooks/usePreferences';
import { useTranslation } from '@/hooks/useTranslation';
import { useBoardTouchSelection } from '@/hooks/useGameScreenInteraction';
import { ChessBoard } from '@/components/ChessBoard';
import { ChessBoardSection } from '@/components/game/ChessBoardSection';
import { ScreenHeader } from '@/components/ScreenHeader';
import { GameReaderNavControls } from '@/components/gameReader/GameReaderNavControls';
import { OpeningStudyNotation } from '@/components/openings/OpeningStudyNotation';
import { OpeningChoiceModal } from '@/components/openings/OpeningChoiceModal';
import { repertoireService, pgnFileDisplayName } from '@/lib/repertoire';
import { downloadPgnFile } from '@/lib/pgn/PgnExporter';
import { formatSanForDisplay } from '@/lib/chess/notation';
import { computeBoardSize, fitBoardSizeToViewport } from '@/lib/game/boardSize';
import {
  EDITOR_NAG_CHOICES,
  createEmptyEditorSession,
  editorAppendMove,
  editorCanGoBack,
  editorCanGoForward,
  editorCanRedo,
  editorCanUndo,
  editorClearComment,
  editorCurrentFen,
  editorCurrentNode,
  editorDeleteCurrentVariation,
  editorExportPgn,
  editorGoEnd,
  editorGoNext,
  editorGoParent,
  editorGoPrev,
  editorGoStart,
  editorLegalDestinations,
  editorMarkSaved,
  editorNodeComment,
  editorRedo,
  editorSelectNode,
  editorSetComment,
  editorSetDisplayName,
  editorToggleNag,
  editorTrySquareMove,
  editorUndo,
  formatNags,
  loadEditorSessionFromPgn,
  type OpeningEditorSession,
} from '@/lib/openingStudy';
import type { BoardPiece, LastMove } from '@/contexts/GameContext';
import { DesignTokens } from '@/constants/designTokens';

const EDITOR_CHROME = 340;

function boardFromFen(fen: string): (BoardPiece | null)[][] {
  return new Chess(fen).board() as (BoardPiece | null)[][];
}

function oneParam(value?: string | string[]): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default function OpeningAnnotateScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { contentTop, contentBottom } = useAppSafeInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const router = useRouter();
  const { showCoordinates } = useBoardCoordinates();
  const { chessNotation } = usePreferences();
  const params = useLocalSearchParams<{
    fileId?: string;
    folderId?: string;
    name?: string;
    nodeId?: string;
  }>();
  const fileIdParam = oneParam(params.fileId);
  const folderIdParam = oneParam(params.folderId);
  const nameParam = oneParam(params.name);
  const nodeIdParam = oneParam(params.nodeId);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<OpeningEditorSession | null>(null);
  const [side, setSide] = useState<'white' | 'black'>('white');
  const [commentDraft, setCommentDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingMove, setPendingMove] = useState<Move | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const boardSize = useMemo(() => {
    const wide = computeBoardSize(windowWidth, 'wide');
    return fitBoardSizeToViewport(
      wide,
      windowHeight,
      EDITOR_CHROME + contentTop + contentBottom,
    );
  }, [windowWidth, windowHeight, contentTop, contentBottom]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        await repertoireService.ensureLoaded();
        if (fileIdParam) {
          const file = repertoireService.getFile(fileIdParam);
          if (!file) {
            setError(t('errors.pgnNotFound'));
            setLoading(false);
            return;
          }
          const folder = repertoireService.getFolder(file.folderId);
          const next = loadEditorSessionFromPgn({
            pgnText: file.pgnText,
            folderId: file.folderId,
            displayName: pgnFileDisplayName(file),
            fileId: file.id,
            focusNodeId: nodeIdParam,
          });
          if (cancelled) return;
          setSide(folder?.side === 'black' ? 'black' : 'white');
          setSession(next);
          setCommentDraft(editorNodeComment(next));
          setError(null);
          setLoading(false);
          return;
        }
        if (!folderIdParam) {
          setError(t('openings.sideRequired'));
          setLoading(false);
          return;
        }
        const folder = repertoireService.getFolder(folderIdParam);
        if (!folder) {
          setError(t('errors.folderNotFound'));
          setLoading(false);
          return;
        }
        const displayName = nameParam?.trim() || t('openings.newStudyDefault');
        const next = createEmptyEditorSession({
          folderId: folderIdParam,
          displayName,
        });
        if (cancelled) return;
        setSide(folder.side === 'black' ? 'black' : 'white');
        setSession(next);
        setCommentDraft('');
        setError(null);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [fileIdParam, folderIdParam, nameParam, nodeIdParam, t]);

  const applySession = useCallback((next: OpeningEditorSession) => {
    setSession(next);
  }, []);

  const flushComment = useCallback(
    (current: OpeningEditorSession): OpeningEditorSession => {
      const node = editorCurrentNode(current);
      if (!node) return current;
      return editorSetComment(current, commentDraft);
    },
    [commentDraft],
  );

  useEffect(() => {
    if (!session) return;
    setCommentDraft(editorNodeComment(session));
  }, [session?.snapshot.currentNodeId, session?.snapshot.game]);

  const mutate = useCallback(
    (updater: (current: OpeningEditorSession) => OpeningEditorSession) => {
      setSession((prev) => {
        if (!prev) return prev;
        return updater(flushComment(prev));
      });
    },
    [flushComment],
  );

  const fen = session ? editorCurrentFen(session) : null;
  const board = useMemo(() => (fen ? boardFromFen(fen) : []), [fen]);
  const node = session ? editorCurrentNode(session) : null;
  const lastMove: LastMove | null = node?.from && node.to ? { from: node.from, to: node.to } : null;

  const getLegalDestinations = useCallback(
    (square: string) => (session ? editorLegalDestinations(session, square) : []),
    [session],
  );

  const movePieceBySquare = useCallback(
    (from: string, to: string) => {
      if (!session) return false;
      const flushed = flushComment(session);
      const result = editorTrySquareMove(flushed, from, to);
      if (!result) return false;
      if (result.kind === 'confirm-variation') {
        setSession(flushed);
        setPendingMove(result.move);
        return true;
      }
      applySession(result.session);
      return true;
    },
    [applySession, flushComment, session],
  );

  const { touchSelected, legalDests, onSquarePress } = useBoardTouchSelection({
    canAct: Boolean(session) && !pendingMove && !busy,
    getLegalDestinations,
    movePieceBySquare,
  });

  const moveLabel = useMemo(() => {
    if (!session) return '';
    if (!node) return t('openings.startLine');
    return t('openings.currentMove', {
      move: `${node.color === 'white' ? `${node.moveNumber}.` : `${node.moveNumber}...`}${formatSanForDisplay(node.san, chessNotation)}${formatNags(node.nags)}`,
    });
  }, [chessNotation, node, session, t]);

  const saveToLibrary = useCallback(async (): Promise<boolean> => {
    if (!session) return false;
    const flushed = flushComment(session);
    const pgn = editorExportPgn(flushed);
    const displayName = flushed.snapshot.displayName.trim() || t('openings.newStudyDefault');
    setBusy(true);
    try {
      if (flushed.fileId) {
        await repertoireService.replacePgn(flushed.fileId, pgn);
        const current = repertoireService.getFile(flushed.fileId);
        if (current && pgnFileDisplayName(current) !== displayName) {
          await repertoireService.renamePgnDisplayName(flushed.fileId, displayName);
        }
        applySession(editorMarkSaved({ ...flushed, snapshot: { ...flushed.snapshot, displayName } }, flushed.fileId));
        return true;
      }
      const file = await repertoireService.importPgn(
        flushed.folderId,
        `${displayName}.pgn`,
        pgn,
        displayName,
      );
      applySession(editorMarkSaved({ ...flushed, snapshot: { ...flushed.snapshot, displayName } }, file.id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSession(flushed);
      return false;
    } finally {
      setBusy(false);
    }
  }, [applySession, flushComment, session, t]);

  const exportPgn = useCallback(() => {
    if (!session) return;
    const flushed = flushComment(session);
    applySession(flushed);
    const name = flushed.snapshot.displayName.trim() || 'opening';
    downloadPgnFile(name.endsWith('.pgn') ? name : `${name}.pgn`, editorExportPgn(flushed));
  }, [applySession, flushComment, session]);

  const requestLeave = useCallback(() => {
    if (!session) {
      router.back();
      return;
    }
    const flushed = flushComment(session);
    if (flushed !== session) applySession(flushed);
    if (flushed.dirty) {
      setLeaveOpen(true);
      return;
    }
    router.back();
  }, [applySession, flushComment, router, session]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: contentTop }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || !session) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: contentTop }]}>
        <ScreenHeader onBack={() => router.back()} title={t('openings.annotatePgn')} />
        <Text style={{ color: colors.destructive, paddingHorizontal: 16 }}>{error}</Text>
      </View>
    );
  }

  const commentBefore = node?.commentBefore?.trim() ?? '';

  return (
    <KeyboardAvoidingView
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingTop: contentTop,
          paddingBottom: contentBottom,
        },
      ]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader
        onBack={requestLeave}
        title={session.snapshot.displayName}
        subtitle={t('openings.annotatePgn')}
        backTestID="opening-annotate-back"
      />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TextInput
          value={session.snapshot.displayName}
          onChangeText={(text) => setSession(editorSetDisplayName(session, text))}
          placeholder={t('openings.newPgnNamePlaceholder')}
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.titleInput,
            { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.input },
          ]}
          testID="opening-annotate-title"
        />

        <ChessBoardSection boardSize={boardSize} testID="opening-annotate-board">
          <ChessBoard
            board={board}
            lastMove={lastMove}
            isFlipped={side === 'black'}
            showCoordinates={showCoordinates}
            sizeMode="wide"
            size={boardSize}
            selectedSquare={touchSelected}
            legalDots={legalDests}
            onSquarePress={onSquarePress}
          />
        </ChessBoardSection>

        <Text style={[styles.moveStatus, { color: colors.foreground }]} testID="opening-annotate-move">
          {moveLabel}
        </Text>

        <GameReaderNavControls
          canGoBack={editorCanGoBack(session)}
          canGoForward={editorCanGoForward(session)}
          onStart={() => mutate(editorGoStart)}
          onPrev={() => mutate(editorGoPrev)}
          onNext={() => mutate(editorGoNext)}
          onEnd={() => mutate(editorGoEnd)}
          labels={{
            start: t('parties.start'),
            prev: t('parties.prev'),
            next: t('parties.next'),
            end: t('parties.end'),
          }}
          testID="opening-annotate-nav"
        />

        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          {t('openings.createVariationHint')}
        </Text>

        <OpeningStudyNotation
          game={session.snapshot.game}
          currentNodeId={session.snapshot.currentNodeId}
          onSelectNode={(id) => mutate((current) => editorSelectNode(current, id))}
        />

        {commentBefore ? (
          <Text style={[styles.beforeComment, { color: colors.mutedForeground }]}>
            {commentBefore}
          </Text>
        ) : null}

        <TextInput
          value={commentDraft}
          onChangeText={setCommentDraft}
          placeholder={
            node ? t('openings.commentPlaceholder') : t('openings.commentNeedMove')
          }
          placeholderTextColor={colors.mutedForeground}
          multiline
          editable={Boolean(node)}
          style={[
            styles.commentInput,
            { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.input },
          ]}
          testID="opening-annotate-comment"
        />

        <View style={styles.rowWrap}>
          <Pressable
            onPress={() => mutate((current) => editorSetComment(current, commentDraft))}
            disabled={!node}
            style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.card }]}
            testID="opening-annotate-save-comment"
          >
            <Text style={[styles.chipLabel, { color: colors.foreground }]}>
              {node?.comment ? t('openings.editComment') : t('openings.addComment')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setCommentDraft('');
              mutate(editorClearComment);
            }}
            disabled={!node?.comment}
            style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.card }]}
            testID="opening-annotate-delete-comment"
          >
            <Text style={[styles.chipLabel, { color: colors.foreground }]}>
              {t('openings.deleteComment')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => mutate(editorGoParent)}
            disabled={!node?.parentId}
            style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.card }]}
            testID="opening-annotate-parent"
          >
            <Text style={[styles.chipLabel, { color: colors.foreground }]}>
              {t('openings.goParentLine')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => mutate(editorDeleteCurrentVariation)}
            disabled={!node}
            style={[styles.chip, { borderColor: colors.destructive, backgroundColor: colors.card }]}
            testID="opening-annotate-delete-variation"
          >
            <Text style={[styles.chipLabel, { color: colors.destructive }]}>
              {t('openings.deleteVariation')}
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          {t('openings.addAnnotation')}
        </Text>
        <View style={styles.rowWrap}>
          {EDITOR_NAG_CHOICES.map((choice) => {
            const active = Boolean(node?.nags?.includes(choice.nag));
            return (
              <Pressable
                key={choice.nag}
                onPress={() => mutate((current) => editorToggleNag(current, choice.nag))}
                disabled={!node}
                style={[
                  styles.nag,
                  {
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active ? colors.secondary : colors.card,
                  },
                ]}
                testID={`opening-annotate-nag-${choice.glyph}`}
              >
                <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
                  {choice.glyph}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.rowWrap}>
          <Pressable
            onPress={() => {
              if (!session) return;
              applySession(editorUndo(session));
            }}
            disabled={!editorCanUndo(session)}
            style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.card }]}
            testID="opening-annotate-undo"
          >
            <Text style={[styles.chipLabel, { color: colors.foreground }]}>{t('openings.undoEdit')}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (!session) return;
              applySession(editorRedo(session));
            }}
            disabled={!editorCanRedo(session)}
            style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.card }]}
            testID="opening-annotate-redo"
          >
            <Text style={[styles.chipLabel, { color: colors.foreground }]}>{t('openings.redoEdit')}</Text>
          </Pressable>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={() => {
              void saveToLibrary();
            }}
            disabled={busy}
            style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }]}
            testID="opening-annotate-save"
          >
            <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold' }}>
              {t('openings.saveToAnyChess')}
            </Text>
          </Pressable>
          <Pressable
            onPress={exportPgn}
            style={[styles.secondaryBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
            testID="opening-annotate-export"
          >
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
              {t('openings.exportPgn')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <OpeningChoiceModal
        visible={pendingMove != null}
        title={t('openings.confirmVariationTitle')}
        body={t('openings.confirmVariationBody', {
          move: pendingMove ? formatSanForDisplay(pendingMove.san, chessNotation) : '',
        })}
        testID="opening-confirm-variation"
        actions={[
          {
            label: t('common.confirm'),
            testID: 'opening-confirm-variation-ok',
            primary: true,
            onPress: () => {
              if (!pendingMove || !session) return;
              const next = editorAppendMove(session, pendingMove);
              setPendingMove(null);
              applySession(next);
            },
          },
          {
            label: t('common.cancel'),
            testID: 'opening-confirm-variation-cancel',
            onPress: () => setPendingMove(null),
          },
        ]}
      />

      <OpeningChoiceModal
        visible={leaveOpen}
        title={t('openings.unsavedTitle')}
        body={t('openings.unsavedBody')}
        testID="opening-unsaved-modal"
        actions={[
          {
            label: t('openings.saveToAnyChess'),
            testID: 'opening-unsaved-save',
            primary: true,
            onPress: () => {
              void (async () => {
                const ok = await saveToLibrary();
                if (ok) {
                  setLeaveOpen(false);
                  router.back();
                }
              })();
            },
          },
          {
            label: t('openings.leaveWithoutSaving'),
            testID: 'opening-unsaved-leave',
            destructive: true,
            onPress: () => {
              setLeaveOpen(false);
              router.back();
            },
          },
          {
            label: t('common.cancel'),
            testID: 'opening-unsaved-cancel',
            onPress: () => setLeaveOpen(false),
          },
        ]}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { gap: 10, paddingBottom: 24 },
  titleInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  moveStatus: {
    fontSize: 14,
    fontFamily: DesignTokens.typography.weightSemiBold,
    textAlign: 'center',
  },
  hint: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  beforeComment: { fontSize: 12, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  commentInput: {
    minHeight: 88,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlignVertical: 'top',
  },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  chipLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  nag: {
    minWidth: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.6,
  },
  actions: { gap: 8, paddingTop: 4 },
  primaryBtn: {
    alignItems: 'center',
    borderRadius: 10,
    paddingVertical: 12,
  },
  secondaryBtn: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 12,
  },
});
