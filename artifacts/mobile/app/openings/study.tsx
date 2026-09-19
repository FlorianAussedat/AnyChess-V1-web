import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
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
import { repertoireService, pgnFileDisplayName, setEphemeralOpeningSession } from '@/lib/repertoire';
import { parseReaderPgn } from '@/lib/gameReader';
import {
  annotatePlayableCommentTokens,
  beginCommentExploration,
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

const STUDY_CHROME = 260;

function boardFromFen(fen: string): (BoardPiece | null)[][] {
  return new Chess(fen).board() as (BoardPiece | null)[][];
}

export default function OpeningStudyScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { contentTop, contentBottom } = useAppSafeInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const router = useRouter();
  const { showCoordinates } = useBoardCoordinates();
  const { chessNotation } = usePreferences();
  const { fileId } = useLocalSearchParams<{ fileId: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [side, setSide] = useState<'white' | 'black'>('white');
  const [sourcePgn, setSourcePgn] = useState('');
  const [state, setState] = useState<OpeningStudyState | null>(null);
  const [tab, setTab] = useState<'comments' | 'notation'>('notation');
  const lastAutoTabNodeId = useRef<string | null>(null);

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

  const comment = state ? combinedCommentText(state) : '';
  const tokens = useMemo(
    () => (state ? annotatePlayableCommentTokens(comment, studyCommentFens(state)) : []),
    [comment, state],
  );

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
    (mode: 'play' | 'continue') => {
      if (!state || !fileId || !folderId) return;
      const sans = lineSansToLeaf(state);
      if (sans.length === 0) return;
      setEphemeralOpeningSession({
        fileId,
        folderId,
        pathSans: sans,
        pathId: sans.join(' '),
        sourcePgn,
        displayName: title,
        side,
        origin: 'study',
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
    [fileId, folderId, router, side, sourcePgn, state, title],
  );

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
          paddingBottom: contentBottom,
        },
      ]}
    >
      <ScreenHeader onBack={() => router.back()} title={title} />

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
        <View style={styles.commentBox} testID="opening-study-comments">
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
      <Pressable
        onPress={() => {
          if (!fileId) return;
          const nodeId = state.currentNodeId ? `&nodeId=${encodeURIComponent(state.currentNodeId)}` : '';
          router.push(
            `/openings/annotate?fileId=${encodeURIComponent(fileId)}${nodeId}` as Href,
          );
        }}
        style={[styles.annotateBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
        testID="opening-study-annotate"
      >
        <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>
          {t('openings.annotateThisPgn')}
        </Text>
      </Pressable>

      <OpeningStudyBranchPicker
        visible={Boolean(pending)}
        choices={pending ?? []}
        onSelect={(nodeId) => setState(selectStudyBranch(state, nodeId))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 12, gap: 8 },
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
  commentBox: { flex: 1, minHeight: 80 },
  actions: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
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
    paddingVertical: 10,
    paddingBottom: 4,
  },
});
