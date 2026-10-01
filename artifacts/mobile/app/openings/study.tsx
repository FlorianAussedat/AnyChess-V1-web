import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Chess } from 'chess.js';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useBoardCoordinates } from '@/hooks/useBoardCoordinates';
import { usePreferences } from '@/hooks/usePreferences';
import { useTranslation } from '@/hooks/useTranslation';
import { ChessBoard } from '@/components/ChessBoard';
import { ChessBoardSection } from '@/components/game/ChessBoardSection';
import { ScreenHeader } from '@/components/ScreenHeader';
import { GameReaderNavControls } from '@/components/gameReader/GameReaderNavControls';
import { OpeningStudyBranchPicker } from '@/components/openings/OpeningStudyBranchPicker';
import { OpeningStudyCommentText } from '@/components/openings/OpeningStudyCommentText';
import { OpeningStudyNotation } from '@/components/openings/OpeningStudyNotation';
import { OpeningLineMasteryRow } from '@/components/openings/OpeningLineMasteryRow';
import { useOpeningMastery } from '@/hooks/useOpeningMastery';
import { repertoireService, pgnFileDisplayName, setEphemeralOpeningSession, describeOpeningPgnMastery, pickUnmasteredLearningPath, openingMasteryStore, reviewLineDisplayName } from '@/lib/repertoire';
import { parseReaderPgn } from '@/lib/gameReader';
import {
  annotatePlayableCommentTokens,
  beginCommentExploration,
  commentsForCurrentPosition,
  combinedCommentText,
  createOpeningStudyState,
  currentStudyFen,
  studyCommentFens,
  currentStudyNode,
  formatNags,
  lastMoveFromSans,
  lineSansToLeaf,
  preferredStudyTab,
  returnToCourse,
  selectStudyBranch,
  studyCanGoBack,
  studyCanGoForward,
  studyGoEnd,
  studyGoNext,
  studyGoPrev,
  studyGoStart,
  tryPlaySanSequence,
  type OpeningStudyState,
} from '@/lib/openingStudy';
import { formatSanForDisplay } from '@/lib/chess/notation';
import {
  computeBoardSize,
  fitBoardSizeToViewport,
} from '@/lib/game/boardSize';
import { preferencesStore } from '@/lib/preferences';
import { getStrengthBand } from '@/lib/difficulty/StockfishStrengthBands';
import { sideToPlayerColor } from '@/lib/repertoire';
import type { BoardPiece, LastMove } from '@/contexts/GameContext';
import { DesignTokens } from '@/constants/designTokens';
import {
  hasUsableFrenchTranslation,
  resolvePgnComment,
  type CommentDisplayMode,
} from '@/lib/pgnComments';
import { usePgnCommentTranslations } from '@/hooks/usePgnCommentTranslations';

const STUDY_CHROME = 260;

function boardFromFen(fen: string): (BoardPiece | null)[][] {
  return new Chess(fen).board() as (BoardPiece | null)[][];
}

export default function OpeningStudyScreen() {
  const colors = useColors();
  const { t, language } = useTranslation();
  const { contentTop, contentBottom } = useAppSafeInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const router = useRouter();
  const { showCoordinates } = useBoardCoordinates();
  const { chessNotation } = usePreferences();
  const { fileId } = useLocalSearchParams<{ fileId: string }>();
  usePgnCommentTranslations();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [side, setSide] = useState<'white' | 'black'>('white');
  const [sourcePgn, setSourcePgn] = useState('');
  const [state, setState] = useState<OpeningStudyState | null>(null);
  const [tab, setTab] = useState<'comments' | 'notation'>('notation');
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const lastAutoTabNodeId = useRef<string | null>(null);
  const mastery = useOpeningMastery();

  const boardSize = useMemo(() => {
    const wide = computeBoardSize(windowWidth, 'wide');
    return fitBoardSizeToViewport(
      wide,
      windowHeight,
      STUDY_CHROME + contentTop + contentBottom,
    );
  }, [windowWidth, windowHeight, contentTop, contentBottom]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!fileId) {
        setError(t('errors.pgnNotFound'));
        setLoading(false);
        return;
      }
      try {
        await repertoireService.ensureLoaded();
        const file = repertoireService.getFile(fileId);
        if (!file) {
          setError(t('errors.pgnNotFound'));
          setLoading(false);
          return;
        }
        const folder = repertoireService.getFolder(file.folderId);
        const parsed = parseReaderPgn(file.pgnText, {
          rawPgn: file.pgnText,
          fileName: file.filename,
        });
        if (!parsed.ok) {
          setError(parsed.error);
          setLoading(false);
          return;
        }
        if (cancelled) return;
        setTitle(pgnFileDisplayName(file));
        setFolderId(file.folderId);
        setSide(folder?.side === 'black' ? 'black' : 'white');
        setSourcePgn(file.pgnText);
        setState(createOpeningStudyState(parsed.game));
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
  }, [fileId, t]);

  useEffect(() => {
    lastAutoTabNodeId.current = null;
  }, [fileId]);

  useEffect(() => {
    if (!state || state.exploringSans) return;
    const id = state.currentNodeId ?? '__start__';
    if (lastAutoTabNodeId.current === id) return;
    lastAutoTabNodeId.current = id;
    setTab(preferredStudyTab(combinedCommentText(state)));
  }, [state]);

  const fen = state ? currentStudyFen(state) : null;
  const board = useMemo(() => (fen ? boardFromFen(fen) : []), [fen]);
  const node = state ? currentStudyNode(state) : null;
  const lastMove: LastMove | null = useMemo(() => {
    if (!state) return null;
    if (state.exploringSans && state.exploringStartFen) {
      return lastMoveFromSans(state.exploringStartFen, state.exploringSans);
    }
    if (!node?.from || !node.to) return null;
    return { from: node.from, to: node.to };
  }, [node, state]);

  const [commentMode, setCommentMode] = useState<CommentDisplayMode>('auto');
  const comment = useMemo(() => {
    if (!state) return '';
    if (!fileId) return combinedCommentText(state);
    const parts = commentsForCurrentPosition(state);
    const nodeId = state.currentNodeId ?? state.game.rootIds[0] ?? 'n1';
    const before = parts.before
      ? resolvePgnComment(
          { source: 'repertoire', fileId, gameIndex: 0, nodeId, slot: 'before' },
          parts.before,
          language,
          commentMode,
        ).text
      : '';
    const after = parts.after
      ? resolvePgnComment(
          { source: 'repertoire', fileId, gameIndex: 0, nodeId, slot: 'after' },
          parts.after,
          language,
          commentMode,
        ).text
      : '';
    return [before, after].filter(Boolean).join('\n\n');
  }, [commentMode, fileId, language, state]);
  const canToggleCommentLanguage = useMemo(() => {
    if (!state || !fileId) return false;
    const parts = commentsForCurrentPosition(state);
    const nodeId = state.currentNodeId ?? state.game.rootIds[0] ?? 'n1';
    return Boolean(
      (parts.before &&
        hasUsableFrenchTranslation(
          { source: 'repertoire', fileId, gameIndex: 0, nodeId, slot: 'before' },
          parts.before,
        )) ||
        (parts.after &&
          hasUsableFrenchTranslation(
            { source: 'repertoire', fileId, gameIndex: 0, nodeId, slot: 'after' },
            parts.after,
          )),
    );
  }, [fileId, state]);
  const tokens = useMemo(
    () => (state ? annotatePlayableCommentTokens(comment, studyCommentFens(state)) : []),
    [comment, state],
  );

  const masteryView = useMemo(() => {
    void mastery.tick;
    if (!fileId) return null;
    const file = repertoireService.getFile(fileId);
    if (!file) return null;
    return describeOpeningPgnMastery(file, openingMasteryStore);
  }, [fileId, mastery.tick, sourcePgn]);

  const moveLabel = useMemo(() => {
    if (!state) return '';
    if (state.exploringSans?.length) {
      const last = state.exploringSans[state.exploringSans.length - 1]!;
      return t('openings.currentMove', { move: formatSanForDisplay(last, chessNotation) });
    }
    if (!node) return t('openings.startLine');
    return t('openings.currentMove', {
      move: `${node.color === 'white' ? `${node.moveNumber}.` : `${node.moveNumber}...`}${formatSanForDisplay(node.san, chessNotation)}${formatNags(node.nags)}`,
    });
  }, [chessNotation, node, state, t]);

  const playCommentSans = useCallback(
    (sans: string[], startFen?: string) => {
      if (!state) return;
      const fens = startFen ? [startFen] : studyCommentFens(state);
      let played = null;
      let usedFen = fens[0]!;
      for (const fen of fens) {
        played = tryPlaySanSequence(fen, sans);
        if (played) {
          usedFen = fen;
          break;
        }
      }
      if (!played) return;
      setState(beginCommentExploration(state, played.legalSans, played.fenAfter, usedFen));
    },
    [state],
  );

  const launchLine = useCallback(
    (mode: 'play' | 'continue', options?: { autoUnmastered?: boolean; sans?: string[]; pathId?: string }) => {
      if (!state || !fileId || !folderId) return;
      const selected = masteryView?.paths.find((p) => p.id === selectedPathId);
      const sans = options?.sans ?? selected?.sans ?? lineSansToLeaf(state);
      if (sans.length === 0) return;
      const matched =
        masteryView?.paths.find((p) => p.id === options?.pathId) ??
        masteryView?.paths.find((p) => p.sans.join(' ') === sans.join(' ')) ??
        selected;
      setEphemeralOpeningSession({
        fileId,
        folderId,
        pathSans: sans,
        pathId: matched?.id ?? options?.pathId ?? sans.join(' '),
        sourcePgn,
        displayName: title,
        lineName: reviewLineDisplayName({
          pathLabel: matched?.sourceLabel,
          fileDisplayName: title,
        }),
        side,
        origin: 'study',
        autoUnmastered: options?.autoUnmastered === true,
      });
      const color = sideToPlayerColor(side);
      if (mode === 'play') {
        const band = getStrengthBand(
          preferencesStore.getPreferences().stockfishStrengthBandId || '',
        ).id;
        router.push(
          `/openings/play?folderId=${encodeURIComponent(folderId)}&fileId=${encodeURIComponent(fileId)}&color=${color}&band=${encodeURIComponent(band)}&from=study` as Href,
        );
        return;
      }
      router.push(
        `/openings/continue?folderId=${encodeURIComponent(folderId)}&fileId=${encodeURIComponent(fileId)}&from=study` as Href,
      );
    },
    [fileId, folderId, masteryView, router, selectedPathId, side, sourcePgn, state, title],
  );

  const launchUnmastered = useCallback(() => {
    if (!fileId || !masteryView) return;
    const pick = pickUnmasteredLearningPath(fileId, masteryView.paths, (key) =>
      openingMasteryStore.historyByKey(key),
    );
    if (!pick) return;
    setSelectedPathId(pick.id);
    launchLine('play', { autoUnmastered: true, sans: pick.sans, pathId: pick.id });
  }, [fileId, launchLine, masteryView]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: contentTop }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || !state) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: contentTop }]}>
        <ScreenHeader onBack={() => router.back()} title={t('openings.learn')} />
        <Text style={{ color: colors.destructive, paddingHorizontal: 16 }}>{error}</Text>
      </View>
    );
  }

  const pending = state.pendingChoices && state.pendingChoices.length > 1 ? state.pendingChoices : null;

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingTop: contentTop,
        },
      ]}
    >
      <ScreenHeader
        onBack={() => router.back()}
        title={title}
        trailing={
          <Pressable
            onPress={() => {
              if (!fileId) return;
              const nodeId = state.currentNodeId
                ? `&nodeId=${encodeURIComponent(state.currentNodeId)}`
                : '';
              router.push(
                `/openings/annotate?fileId=${encodeURIComponent(fileId)}${nodeId}` as Href,
              );
            }}
            style={[styles.annotateBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
            testID="opening-study-annotate"
          >
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>
              {t('openings.annotateThisPgn')}
            </Text>
          </Pressable>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: contentBottom + 12 }]}
        keyboardShouldPersistTaps="handled"
        testID="opening-study-scroll"
      >
      <ChessBoardSection boardSize={boardSize} testID="opening-study-board">
        <ChessBoard
          board={board}
          lastMove={lastMove}
          isFlipped={side === 'black'}
          showCoordinates={showCoordinates}
          sizeMode="wide"
          size={boardSize}
        />
      </ChessBoardSection>

      <Text style={[styles.moveStatus, { color: colors.foreground }]} testID="opening-study-move">
        {moveLabel}
      </Text>

      <GameReaderNavControls
        canGoBack={studyCanGoBack(state)}
        canGoForward={studyCanGoForward(state)}
        onStart={() => setState(studyGoStart(state))}
        onPrev={() => setState(studyGoPrev(state))}
        onNext={() => setState(studyGoNext(state))}
        onEnd={() => setState(studyGoEnd(state))}
        labels={{
          start: t('parties.start'),
          prev: t('parties.prev'),
          next: t('parties.next'),
          end: t('parties.end'),
        }}
        testID="opening-study-nav"
      />

      {state.exploringSans ? (
        <Pressable
          onPress={() => setState(returnToCourse(state))}
          style={[styles.returnBtn, { backgroundColor: colors.primary }]}
          testID="opening-study-return"
        >
          <Text style={[styles.returnLabel, { color: colors.primaryForeground }]}>
            {t('openings.returnToCourse')}
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.tabs}>
        <Pressable
          onPress={() => setTab('comments')}
          style={[
            styles.tab,
            {
              borderColor: tab === 'comments' ? colors.primary : colors.border,
              backgroundColor: tab === 'comments' ? colors.secondary : colors.card,
            },
          ]}
          testID="opening-study-tab-comments"
        >
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
            {t('openings.tabComments')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('notation')}
          style={[
            styles.tab,
            {
              borderColor: tab === 'notation' ? colors.primary : colors.border,
              backgroundColor: tab === 'notation' ? colors.secondary : colors.card,
            },
          ]}
          testID="opening-study-tab-notation"
        >
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
            {t('openings.tabNotation')}
          </Text>
        </Pressable>
      </View>

      {tab === 'comments' ? (
        <View testID="opening-study-comments">
          {comment.trim() && canToggleCommentLanguage ? (
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <Pressable
                onPress={() => setCommentMode('original')}
                testID="opening-study-comment-original"
              >
                <Text style={{ color: colors.primary }}>{t('pgn.commentOriginal')}</Text>
              </Pressable>
              <Pressable
                onPress={() => setCommentMode('french')}
                testID="opening-study-comment-french"
              >
                <Text style={{ color: colors.primary }}>{t('pgn.commentFrench')}</Text>
              </Pressable>
            </View>
          ) : null}
          <OpeningStudyCommentText
            tokens={tokens.length ? tokens : [{ kind: 'text', text: comment }]}
            emptyLabel={t('openings.noComment')}
            onPlaySans={playCommentSans}
          />
        </View>
      ) : (
        <OpeningStudyNotation
          game={state.game}
          currentNodeId={state.currentNodeId}
          onSelectNode={(id) => setState(selectStudyBranch(state, id))}
        />
      )}

      {masteryView ? (
        <View style={styles.lineList} testID="opening-study-lines">
          {masteryView.lines.map((line) => (
            <OpeningLineMasteryRow
              key={line.key}
              line={line}
              selected={selectedPathId === line.path.id}
              onPress={() => setSelectedPathId(line.path.id)}
              testID={`opening-study-line-${line.path.id}`}
            />
          ))}
          <Pressable
            onPress={launchUnmastered}
            disabled={!masteryView.lines.some((l) => !l.mastered)}
            style={[
              styles.trainBtn,
              {
                backgroundColor: colors.secondary,
                borderColor: colors.border,
                opacity: masteryView.lines.some((l) => !l.mastered) ? 1 : 0.45,
              },
            ]}
            testID="opening-study-train-unmastered"
          >
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>
              {masteryView.lines.some((l) => !l.mastered)
                ? t('openings.trainUnmastered')
                : t('openings.noUnmasteredLines')}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          onPress={() => launchLine('play')}
          style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          testID="opening-study-play-line"
        >
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>
            {t('openings.playThisLine')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => launchLine('continue')}
          style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          testID="opening-study-continue-line"
        >
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>
            {t('openings.continueThisLine')}
          </Text>
        </Pressable>
      </View>
      </ScrollView>

      <OpeningStudyBranchPicker
        visible={Boolean(pending)}
        choices={pending ?? []}
        onSelect={(nodeId) => setState(selectStudyBranch(state, nodeId))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 12 },
  scroll: { flex: 1 },
  scrollContent: { gap: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  moveStatus: {
    fontSize: 14,
    fontFamily: DesignTokens.typography.weightSemiBold,
    textAlign: 'center',
  },
  returnBtn: {
    alignSelf: 'center',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  returnLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
  },
  actions: { flexDirection: 'row', gap: 8 },
  lineList: { gap: 8, marginTop: 4 },
  trainBtn: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
  },
  annotateBtn: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
});
