/**
 * Unified game workspace — Partie + Analyse tabs on one ReaderGame state.
 * Old Lecteur route `/parties/[gameId]` redirects here.
 * Stockfish observes the same FEN; tab switches never reload PGN.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Chess } from 'chess.js';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import {
  AnyLyseurExportMenu,
  AnyLyseurToolbar,
  EngineLinesPanel,
  EvalBalanceBar,
  EvalCurve,
  SelectedMovePanel,
  type EvalCurvePoint,
} from '@/components/analysis';
import { ChessScreenScaffold } from '@/components/game/ChessScreenScaffold';
import { SharedGameReaderView } from '@/components/gameReader';
import { DesignTokens } from '@/constants/designTokens';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useBoardCoordinates } from '@/hooks/useBoardCoordinates';
import { useColors } from '@/hooks/useColors';
import { useBoardTouchSelection } from '@/hooks/useGameScreenInteraction';
import { usePreferences } from '@/hooks/usePreferences';
import { useTranslation } from '@/hooks/useTranslation';
import {
  buildLiveFocus,
  buildSelectedMoveReview,
  collectActiveLineNodes,
  collectMainLineNodes,
  exportEnrichedPgn,
  resolveBoardPresentation,
  sameChessPosition,
  useAnyLyseurAnalysis,
  type AnalysisProfileId,
  type PositionAnalysis,
} from '@/lib/analysis';
import { formatSanForDisplay } from '@/lib/chess/notation';
import { copyToClipboard } from '@/lib/clipboard';
import {
  anyChessPgnFilename,
  downloadPgnFile,
} from '@/lib/pgn/PgnExporter';
import {
  computeBoardSize,
  fitBoardSizeToViewport,
} from '@/lib/game/boardSize';
import { gameLibraryStore, saveReaderGameToLibrary } from '@/lib/gameLibrary';
import {
  ANALYZER_DRAFT_HANDOFF,
  takeParkedAnalyzerDraft,
} from '@/lib/gameLibrary/parkedAnalyzerDraft';
import { validateAnalysisFen } from '@/lib/gameLibrary/validateAnalysisFen';
import {
  emptyReaderGame,
  flushSharedGameSession,
  loadSharedGameSession,
  parseReaderPgn,
  readerGameFromImported,
  saveSharedGameSession,
  useGameReader,
  type ReaderGame,
} from '@/lib/gameReader';
import {
  OPENING_EDITOR_ANALYZER_SOURCE,
  analyzedLineSans,
  graftAnalyzedLineOntoParkedEditor,
  setParkedOpeningEditor,
} from '@/lib/openingStudy';
import { CreateOpeningStudyModal } from '@/components/openings/CreateOpeningStudyModal';
import { usePersistedActivity } from '@/hooks/usePersistedActivity';

const RESERVED_CHROME = 340;

type TabId = 'game' | 'analysis';

export default function GameWorkspaceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    gameId?: string;
    nodeId?: string;
    flipped?: string;
    tab?: string;
    source?: string;
    sessionId?: string;
    draft?: string;
    blank?: string;
  }>();
  const gameId = typeof params.gameId === 'string' ? params.gameId : '';
  const isDraft = params.draft === ANALYZER_DRAFT_HANDOFF || params.draft === '1';
  const isBlankStart = params.blank === '1' || (!gameId && !isDraft);
  const paramNodeId =
    typeof params.nodeId === 'string' && params.nodeId.length > 0
      ? params.nodeId
      : null;
  const paramFlipped = params.flipped === '1';
  // Extra UI only — must not change click / legality / coordinates / selection.
  const fromOpeningEditor = params.source === OPENING_EDITOR_ANALYZER_SOURCE;
  const fromLiveWorkflow = fromOpeningEditor || params.source === 'live';
  const initialTab: TabId =
    params.tab === 'analysis' ? 'analysis' : 'game';

  const colors = useColors();
  const { t } = useTranslation();
  const { chessNotation } = usePreferences();
  const { contentTop, contentBottom } = useAppSafeInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { showCoordinates } = useBoardCoordinates();

  const [pgnDraft, setPgnDraft] = useState('');
  const [game, setGame] = useState<ReaderGame | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>(initialTab);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [includeEvals, setIncludeEvals] = useState(true);
  const [showPaste, setShowPaste] = useState(false);
  const [restoreNodeId, setRestoreNodeId] = useState<string | null>(
    paramNodeId,
  );
  const [restoreFlipped, setRestoreFlipped] = useState(paramFlipped);
  const [restoreOrigin, setRestoreOrigin] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [studyOpen, setStudyOpen] = useState(false);
  const [savedLibraryId, setSavedLibraryId] = useState<string | null>(
    gameId || null,
  );

  useEffect(() => {
    return () => {
      void flushSharedGameSession();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadBlank = () => {
      setGame(emptyReaderGame());
      setShowPaste(false);
      setRestoreFlipped(false);
      setTab(params.tab === 'game' ? 'game' : 'analysis');
      setSessionReady(true);
    };
    if (gameId) {
      void (async () => {
        try {
          const [imported, session] = await Promise.all([
            gameLibraryStore.getGame(gameId),
            loadSharedGameSession(gameId),
          ]);
          if (cancelled) return;
          if (session && session.gameId === gameId) {
            setPgnDraft(
              session.game.rawPgn?.trim() ||
                session.game.source?.rawPgn?.trim() ||
                '',
            );
            setError(null);
            setGame(session.game);
            setShowPaste(false);
            setSavedLibraryId(gameId);
            setRestoreNodeId(paramNodeId ?? session.currentNodeId);
            setRestoreFlipped(paramFlipped || session.boardFlipped);
            setRestoreOrigin(session.explorationOriginNodeId);
          } else if (imported) {
            setPgnDraft(imported.source.rawPgn?.trim() || '');
            setError(null);
            setGame(
              readerGameFromImported({
                id: imported.id,
                fingerprint: imported.fingerprint,
                headers: imported.headers,
                initialFen: imported.initialFen,
                moves: imported.moves,
                hasVariations: imported.hasVariations,
                rawPgn: imported.source.rawPgn,
                source: imported.source,
              }),
            );
            setShowPaste(false);
            setSavedLibraryId(gameId);
            if (paramNodeId) setRestoreNodeId(paramNodeId);
            if (paramFlipped) setRestoreFlipped(true);
          }
          setSessionReady(true);
        } catch {
          if (cancelled) return;
          setError(t('errors.generic'));
          loadBlank();
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    if (isDraft) {
      const parked = takeParkedAnalyzerDraft();
      if (parked?.fen) {
        const checked = validateAnalysisFen(parked.fen);
        if (!checked.ok) {
          setError(t('parties.fenInvalid'));
          loadBlank();
          return () => {
            cancelled = true;
          };
        }
        setError(null);
        setGame(emptyReaderGame(checked.fen));
        setShowPaste(false);
        setRestoreFlipped(false);
        setTab(parked.tab === 'game' ? 'game' : 'analysis');
        setSessionReady(true);
        return () => {
          cancelled = true;
        };
      }
      if (parked?.pgnText) {
        const result = parseReaderPgn(parked.pgnText, { allowEmptyMoves: true });
        if (!result.ok) {
          setError(t('parties.pgnInvalid'));
          loadBlank();
          return () => {
            cancelled = true;
          };
        }
        setError(null);
        setPgnDraft(parked.pgnText);
        setGame(result.game);
        setShowPaste(false);
        setRestoreFlipped(false);
        setTab(parked.tab === 'game' ? 'game' : 'analysis');
        setSessionReady(true);
        return () => {
          cancelled = true;
        };
      }
    }

    loadBlank();
    return () => {
      cancelled = true;
    };
  }, [gameId, isDraft, isBlankStart, paramNodeId, paramFlipped, params.tab, t]);

  const reader = useGameReader({
    game: sessionReady ? game : null,
    initialNodeId: restoreNodeId,
    initialFlipped: restoreFlipped,
    initialExplorationOriginNodeId: restoreOrigin,
    autosaveSession: Boolean(game),
    analysisProfileId: undefined,
  });

  const analyzerGameId = gameId || game?.id || '';
  const resumeSessionId =
    typeof params.sessionId === 'string'
      ? params.sessionId
      : analyzerGameId
        ? `parties_${analyzerGameId}`
        : undefined;
  usePersistedActivity({
    kind: 'parties-analyzer',
    modeId: 'parties',
    resumeSessionId,
    title: t('parties.workspace'),
    summary: game
      ? game.headers.opening ||
        [game.headers.white, game.headers.black].filter(Boolean).join(' – ')
      : '',
    routeFor: (id) => {
      const qs = new URLSearchParams();
      if (analyzerGameId) qs.set('gameId', analyzerGameId);
      qs.set('sessionId', id);
      if (tab === 'analysis') qs.set('tab', 'analysis');
      return `/parties/analyzer?${qs.toString()}`;
    },
    enabled: !!game && !showPaste && !fromLiveWorkflow,
    revision: `${analyzerGameId}|${reader?.currentNodeId ?? ''}|${tab}`,
    capture: () => ({ gameId: analyzerGameId, tab }),
  });

  const {
    state: analysis,
    setProfile,
    reanalyze,
    setArrowsEnabled,
    retryEngine,
    lookupPosition,
  } = useAnyLyseurAnalysis({
    game: reader?.game ?? game,
    currentFen: reader?.currentFen ?? null,
    currentNodeId: reader?.currentNodeId ?? null,
    activeLineNodeIds: reader?.activeLineNodeIds ?? [],
  });

  // "Analysée" is session-cache only — do not persist a disk flag.
  const analysisProgressLabel = useMemo(() => {
    if (!analysis?.gameProgress.running) return null;
    const done = String(analysis.gameProgress.done);
    const total = String(analysis.gameProgress.total);
    if (analysis.gameProgress.phase === 'variants') {
      return t('parties.anyliseurProgressVariants', { done, total });
    }
    if (analysis.gameProgress.phase === 'main') {
      return t('parties.anyliseurProgressMain', { done, total });
    }
    return t('parties.anyliseurProgress', { done, total });
  }, [analysis?.gameProgress, t]);

  const boardSize = useMemo(() => {
    const wide = computeBoardSize(windowWidth, 'wide');
    return fitBoardSizeToViewport(
      wide,
      windowHeight,
      Math.max(220, RESERVED_CHROME + contentTop + contentBottom),
    );
  }, [windowWidth, windowHeight, contentTop, contentBottom]);

  const showEngineUi = tab === 'analysis';
  const replayMode = tab === 'game';

  const currentNode =
    reader?.currentNodeId && game
      ? game.nodesById[reader.currentNodeId]
      : null;

  const positionFor = useCallback(
    (fen: string | null | undefined): PositionAnalysis | null => {
      if (!fen || !analysis) return null;
      const live = analysis.position;
      if (
        live &&
        live.evalPerspective === 'white' &&
        live.profileId === analysis.profileId &&
        sameChessPosition(live.fen, fen)
      ) {
        return live;
      }
      const cached = lookupPosition(fen);
      if (!cached || cached.profileId !== analysis.profileId) return null;
      if (!sameChessPosition(cached.fen, fen)) return null;
      return cached;
    },
    [analysis, lookupPosition],
  );

  const displayPosition =
    showEngineUi && reader?.currentFen
      ? positionFor(reader.currentFen)
      : null;

  const beforeAnalysis = currentNode ? positionFor(currentNode.fenBefore) : null;
  const afterAnalysis = currentNode ? positionFor(currentNode.fenAfter) : null;

  const review = currentNode
    ? buildSelectedMoveReview({
        fenBefore: currentNode.fenBefore,
        fenAfter: currentNode.fenAfter,
        playedSan: currentNode.san,
        playedUci:
          currentNode.from && currentNode.to
            ? `${currentNode.from}${currentNode.to}${currentNode.promotion ?? ''}`
            : null,
        before: beforeAnalysis,
        after: afterAnalysis,
      })
    : null;

  const liveFocus =
    showEngineUi && reader?.currentFen
      ? buildLiveFocus(reader.currentFen, displayPosition)
      : null;

  const evalValue = liveFocus?.evaluation ?? null;

  const curvePoints = useMemo((): EvalCurvePoint[] => {
    if (!game || !reader) return [];
    const active = collectActiveLineNodes(game, reader.activeLineNodeIds);
    const line = active.length > 0 ? active : collectMainLineNodes(game);
    return line.map((node) => {
      const stored = analysis?.gameNodes[node.nodeId];
      const trusted =
        stored &&
        stored.evalPerspective === 'white' &&
        sameChessPosition(stored.fen, node.fen)
          ? stored
          : null;
      return {
        nodeId: node.nodeId,
        fen: node.fen,
        moveNumber: node.moveNumber,
        plyColor: node.color === 'white' ? 'w' : 'b',
        analysis: trusted,
      };
    });
  }, [game, reader, analysis]);

  const boardPresentation = resolveBoardPresentation({
    mode: replayMode ? 'replay' : 'live',
    arrowsEnabled: analysis?.arrowsEnabled ?? true,
    liveFen: reader?.currentFen ?? game?.initialFen ?? '',
    selected: currentNode
      ? {
          fenBefore: currentNode.fenBefore,
          fenAfter: currentNode.fenAfter,
          san: currentNode.san,
        }
      : null,
  });

  const arrows = useMemo(() => {
    if (!(analysis?.arrowsEnabled ?? true)) return [];
    if (replayMode) {
      if (!boardPresentation.preview || !beforeAnalysis || !currentNode) return [];
      const arrow = review?.arrow;
      if (!arrow) return [];
      return [{ from: arrow.from, to: arrow.to, color: colors.primary }];
    }
    const arrow = liveFocus?.arrow;
    if (!arrow || !displayPosition) return [];
    return [{ from: arrow.from, to: arrow.to, color: colors.primary }];
  }, [
    analysis?.arrowsEnabled,
    replayMode,
    boardPresentation.preview,
    beforeAnalysis,
    currentNode,
    review?.arrow,
    liveFocus?.arrow,
    displayPosition,
    colors.primary,
  ]);

  const persistPosition = useCallback(() => {
    if (!game || !reader) return;
    void saveSharedGameSession({
      gameId: reader.game.id,
      game: reader.game,
      currentNodeId: reader.currentNodeId,
      activeLineNodeIds: reader.activeLineNodeIds,
      boardFlipped: reader.boardFlipped,
      explorationOriginNodeId: reader.explorationOriginNodeId,
      analysisProfileId: analysis?.profileId,
      analysisCacheSummary: analysis
        ? {
            analyzedNodeCount: Object.keys(analysis.gameNodes).length,
            lastFen: reader.currentFen,
            profileId: analysis.profileId,
          }
        : undefined,
    });
  }, [game, reader, analysis]);

  const returnToOpeningEditor = useCallback(() => {
    persistPosition();
    router.back();
  }, [persistPosition, router]);

  const addAnalyzedLineToPgn = useCallback(() => {
    if (!reader) return;
    graftAnalyzedLineOntoParkedEditor(
      reader.game,
      reader.explorationOriginNodeId,
      reader.currentNodeId,
    );
    persistPosition();
    router.back();
  }, [persistPosition, reader, router]);

  const onLoad = () => {
    const draft = pgnDraft.trim();
    if (!draft) {
      setError(t('parties.analyzerEmpty'));
      return;
    }
    const fenLike = draft.split(/\s+/).length >= 4 && !draft.includes('[');
    if (fenLike) {
      try {
        new Chess(draft);
        const empty = emptyReaderGame(draft);
        setError(null);
        setGame(empty);
        setShowPaste(false);
        setExportStatus(t('parties.anyliseurFenLoaded'));
        return;
      } catch {
        /* fall through to PGN */
      }
    }
    const result = parseReaderPgn(draft, { allowEmptyMoves: true });
    if (!result.ok) {
      setError(
        t('parties.anyliseurImportInvalid') +
          (result.detail ? ` ${result.detail}` : ''),
      );
      return;
    }
    setError(null);
    setGame(result.game);
    setShowPaste(false);
  };

  const buildExportPgn = useCallback(() => {
    const g = reader?.game ?? game;
    if (!g) return '';
    return exportEnrichedPgn({
      game: g,
      nodes: analysis?.gameNodes ?? {},
      includeEvals,
      includeBest: includeEvals,
    });
  }, [reader?.game, game, analysis?.gameNodes, includeEvals]);

  const onCopyPgn = async () => {
    const pgn = buildExportPgn();
    if (!pgn) return;
    const ok = await copyToClipboard(pgn);
    setExportStatus(
      ok ? t('parties.anyliseurExportDone') : t('parties.anyliseurExportFail'),
    );
    setExportMenuOpen(false);
  };

  const onDownloadPgn = () => {
    const pgn = buildExportPgn();
    if (!pgn) return;
    downloadPgnFile(anyChessPgnFilename(), pgn);
    setExportStatus(t('parties.anyliseurExportDone'));
    setExportMenuOpen(false);
  };

  const onCopyFen = async () => {
    const fen = reader?.currentFen;
    if (!fen) return;
    const ok = await copyToClipboard(fen);
    setExportStatus(
      ok ? t('parties.anyliseurExportDone') : t('parties.anyliseurExportFail'),
    );
    setExportMenuOpen(false);
  };

  const onDownloadFen = () => {
    const fen = reader?.currentFen;
    if (!fen) return;
    downloadPgnFile('position.fen', fen);
    setExportStatus(t('parties.anyliseurExportDone'));
    setExportMenuOpen(false);
  };

  const onImport = useCallback(async () => {
    persistPosition();
    router.push('/parties/import' as Href);
  }, [persistPosition, router]);

  const onSaveToLibrary = useCallback(async () => {
    const current = reader?.game ?? game;
    if (!current) return;
    if (savedLibraryId) {
      setExportStatus(t('parties.alreadySaved'));
      return;
    }
    try {
      const saved = await saveReaderGameToLibrary({ game: current });
      if (saved) {
        setSavedLibraryId(saved.id);
        setExportStatus(t('parties.savedToUnfiled'));
      } else {
        setExportStatus(t('parties.pgnInvalid'));
      }
    } catch (e) {
      setExportStatus(e instanceof Error ? e.message : t('errors.generic'));
    }
  }, [game, reader?.game, savedLibraryId, t]);

  const onProfileChange = useCallback(
    (id: AnalysisProfileId) => {
      setProfile(id);
      void reanalyze(id);
    },
    [setProfile, reanalyze],
  );

  const getLegalDestinations = useCallback(
    (square: string) => {
      if (!reader) return [];
      try {
        const chess = new Chess(reader.currentFen);
        return chess
          .moves({ square: square as never, verbose: true })
          .map((m) => m.to);
      } catch {
        return [];
      }
    },
    [reader?.currentFen],
  );

  const movePieceBySquare = useCallback(
    (from: string, to: string) => {
      if (!reader) return false;
      try {
        const chess = new Chess(reader.currentFen);
        const matches = chess
          .moves({ square: from as never, verbose: true })
          .filter((m) => m.to === to);
        if (matches.length === 0) return false;
        const promo = matches.find((m) => m.promotion)?.promotion;
        reader.playMove(from, to, promo);
        return true;
      } catch {
        return false;
      }
    },
    [reader],
  );

  // Same selection hook as Classic / editor — opening-editor source is not an input.
  const { touchSelected, legalDests, onSquarePress } = useBoardTouchSelection({
    canAct: Boolean(reader),
    getLegalDestinations,
    movePieceBySquare,
  });

  const canReturnToOrigin = Boolean(
    reader &&
      reader.explorationOriginNodeId != null &&
      (reader.explorationOriginNodeId === ''
        ? reader.currentNodeId != null
        : reader.currentNodeId !== reader.explorationOriginNodeId),
  );

  const toolbar = reader ? (
    <AnyLyseurToolbar
      onFlip={() => reader.flipBoard()}
      arrowsEnabled={analysis?.arrowsEnabled ?? true}
      onToggleArrows={() =>
        setArrowsEnabled(!(analysis?.arrowsEnabled ?? true))
      }
      profileId={analysis?.profileId ?? 'fast'}
      onProfileChange={onProfileChange}
      onImport={onImport}
      onExport={() => setExportMenuOpen(true)}
      showEngineControls={showEngineUi}
      canReturnToOrigin={canReturnToOrigin}
      onReturnToOrigin={() => reader.returnToExplorationOrigin()}
    />
  ) : null;

  const engineUnavailable =
    analysis?.engineStatus === 'unavailable' ||
    analysis?.engineStatus === 'error';

  const reviewStatus: 'pending' | 'ready' | 'unavailable' | 'terminal' | 'incomplete' =
    beforeAnalysis?.terminalOutcome
      ? 'terminal'
      : beforeAnalysis &&
          !review?.bestSan &&
          (beforeAnalysis.lines.length === 0 ||
            (beforeAnalysis.mate != null || beforeAnalysis.evaluation != null))
        ? 'incomplete'
        : beforeAnalysis
          ? 'ready'
          : engineUnavailable
            ? 'unavailable'
            : 'pending';

  const liveStatus: 'pending' | 'ready' | 'unavailable' | 'terminal' | 'incomplete' =
    liveFocus?.terminal
      ? 'terminal'
      : displayPosition && liveFocus && liveFocus.possibilities.length === 0
        ? 'incomplete'
        : displayPosition
          ? 'ready'
          : engineUnavailable
            ? 'unavailable'
            : 'pending';

  const statusLine = (
    <Text style={[styles.status, { color: colors.mutedForeground }]}>
      {engineUnavailable
        ? t('parties.anyliseurUnavailable')
        : analysis?.engineStatus === 'analyzing'
          ? t('parties.anyliseurAnalyzing')
          : analysis?.engineStatus === 'initializing'
            ? t('parties.anyliseurInitializing')
            : t('parties.anyliseurReady')}
      {analysisProgressLabel ? ` · ${analysisProgressLabel}` : ''}
    </Text>
  );

  const retryButton = engineUnavailable ? (
    <Pressable
      testID="anyliseur-retry-engine"
      onPress={() => void retryEngine()}
      style={[
        styles.chip,
        { borderColor: colors.border, backgroundColor: colors.card },
      ]}
    >
      <Text style={[styles.chipLabel, { color: colors.primary }]}>
        {t('parties.anyliseurRetry')}
      </Text>
    </Pressable>
  ) : null;

  const curve = (
    <EvalCurve
      points={curvePoints}
      activeNodeId={reader?.currentNodeId ?? null}
      onSelectNode={(nodeId) => reader?.goToNode(nodeId)}
    />
  );

  const reviewPanel = (
    <View style={styles.analysisPanel} testID="anyliseur-review-panel">
      {statusLine}
      {retryButton}
      {review && currentNode ? (
        <SelectedMovePanel
          review={review}
          notation={chessNotation}
          linesFen={currentNode.fenBefore}
          lines={beforeAnalysis?.lines ?? []}
          status={reviewStatus}
        />
      ) : (
        <Text
          style={{ color: colors.mutedForeground, fontSize: 13 }}
          testID="anyliseur-select-move"
        >
          {t('parties.anyliseurSelectMove')}
        </Text>
      )}
      {curve}
      {exportStatus ? (
        <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
          {exportStatus}
        </Text>
      ) : null}
    </View>
  );

  const analysisPanel = (
    <View style={styles.analysisPanel} testID="anyliseur-analysis-panel">
      {statusLine}
      {retryButton}
      <EngineLinesPanel
        fen={reader?.currentFen ?? game?.initialFen ?? ''}
        lines={displayPosition?.lines ?? []}
        notation={chessNotation}
        title={t('parties.anyliseurLiveMoves')}
        emptyLabel={
          liveStatus === 'pending'
            ? t('parties.anyliseurAnalyzing')
            : liveStatus === 'terminal'
              ? t('parties.anyliseurTerminal')
              : liveStatus === 'incomplete'
                ? t('parties.anyliseurEvalIncomplete')
                : t('parties.anyliseurEvalMissing')
        }
        testID="anyliseur-live-lines"
      />
      {exportStatus ? (
        <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
          {exportStatus}
        </Text>
      ) : null}
    </View>
  );

  return (
    <ChessScreenScaffold
      title={t('parties.workspace')}
      subtitle={t('parties.workspaceSubtitle')}
      onBack={() => {
        persistPosition();
        if (fromOpeningEditor) router.back();
        else router.navigate('/parties');
      }}
      trailing={
        game && !fromOpeningEditor ? (
          <Pressable
            testID="anyliseur-save"
            onPress={() => void onSaveToLibrary()}
            accessibilityRole="button"
            accessibilityLabel={t('parties.saveAnalysis')}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text
              style={{
                color: colors.primary,
                fontFamily: DesignTokens.typography.weightSemiBold,
                fontSize: 14,
              }}
            >
              {t('parties.saveAnalysis')}
            </Text>
          </Pressable>
        ) : undefined
      }
      testID="game-workspace"
    >
      {!game || showPaste ? (
        <View style={styles.importPanel} testID="anyliseur-import-panel">
          <Pressable
            testID="anyliseur-import-file"
            onPress={() => void onImport()}
            style={({ pressed }) => [
              styles.loadBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.loadText}>{t('parties.anyliseurImportFile')}</Text>
          </Pressable>
          <Pressable
            testID="anyliseur-import-library"
            onPress={() => router.push('/parties' as Href)}
            style={({ pressed }) => [
              styles.chip,
              {
                borderColor: colors.border,
                backgroundColor: colors.card,
                opacity: pressed ? 0.85 : 1,
                alignItems: 'center',
                paddingVertical: 12,
              },
            ]}
          >
            <Text style={[styles.chipLabel, { color: colors.foreground }]}>
              {t('parties.anyliseurImportLibrary')}
            </Text>
          </Pressable>
          <Text
            style={[styles.empty, { color: colors.mutedForeground }]}
          >
            {t('parties.anyliseurImportPaste')}
          </Text>
          <TextInput
            testID="game-analyzer-pgn-input"
            value={pgnDraft}
            onChangeText={setPgnDraft}
            multiline
            placeholder={t('parties.analyzerPaste')}
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.input,
              {
                color: colors.foreground,
                borderColor: colors.border,
                backgroundColor: colors.card,
              },
            ]}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable
            testID="game-analyzer-load"
            onPress={onLoad}
            style={({ pressed }) => [
              styles.loadBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.loadText}>{t('parties.analyzerLoad')}</Text>
          </Pressable>
          {game ? (
            <Pressable
              testID="anyliseur-import-cancel"
              onPress={() => setShowPaste(false)}
              style={{ alignItems: 'center', paddingVertical: 8 }}
            >
              <Text style={{ color: colors.mutedForeground }}>
                {t('common.cancel')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {error ? (
        <Text style={styles.error} testID="game-analyzer-error">
          {error}
        </Text>
      ) : null}

      {game && !showPaste && reader ? (
        <View style={styles.readerWrap}>
          <View style={styles.tabs} testID="anyliseur-tabs">
            <Pressable
              testID="anyliseur-tab-game"
              accessibilityRole="button"
              accessibilityState={{ selected: tab === 'game' }}
              onPress={() => setTab('game')}
              style={[
                styles.tab,
                {
                  backgroundColor:
                    tab === 'game' ? colors.primary : colors.card,
                  borderColor: colors.border,
                  cursor: 'pointer' as const,
                },
              ]}
            >
              <Text
                style={{
                  color:
                    tab === 'game'
                      ? colors.primaryForeground
                      : colors.foreground,
                  fontFamily: DesignTokens.typography.weightSemiBold,
                }}
              >
                {t('parties.anyliseurTabGame')}
              </Text>
            </Pressable>
            <Pressable
              testID="anyliseur-tab-analysis"
              accessibilityRole="button"
              accessibilityState={{ selected: tab === 'analysis' }}
              onPress={() => setTab('analysis')}
              style={[
                styles.tab,
                {
                  backgroundColor:
                    tab === 'analysis' ? colors.primary : colors.card,
                  borderColor: colors.border,
                  cursor: 'pointer' as const,
                },
              ]}
            >
              <Text
                style={{
                  color:
                    tab === 'analysis'
                      ? colors.primaryForeground
                      : colors.foreground,
                  fontFamily: DesignTokens.typography.weightSemiBold,
                }}
              >
                {t('parties.anyliseurTabAnalysis')}
              </Text>
            </Pressable>
          </View>

          {/* Single board instance — tab switch never remounts reader state */}
          <SharedGameReaderView
            reader={reader}
            boardSize={boardSize}
            showCoordinates={showCoordinates}
            pgnComment={
              gameId
                ? { source: 'gameLibrary', fileId: gameId }
                : undefined
            }
            showPlayers
            showNotation={tab === 'game'}
            showToolbar={false}
            toolbarSlot={toolbar}
            arrows={arrows}
            boardFen={boardPresentation.preview ? boardPresentation.fen : null}
            previewLabel={
              boardPresentation.preview && boardPresentation.previewSan
                ? t('parties.anyliseurBestPreview', {
                    move: formatSanForDisplay(
                      boardPresentation.previewSan,
                      chessNotation,
                    ),
                  })
                : null
            }
            onSquarePress={boardPresentation.preview ? undefined : onSquarePress}
            selectedSquare={boardPresentation.preview ? null : touchSelected}
            legalDots={boardPresentation.preview ? [] : legalDests}
            topSlot={
              showEngineUi ? (
                <EvalBalanceBar
                  value={evalValue}
                  depth={displayPosition?.depth}
                  loading={
                    analysis?.engineStatus === 'analyzing' && !displayPosition
                  }
                />
              ) : null
            }
            bottomSlot={
              showEngineUi && analysisProgressLabel ? (
                <Text
                  style={{ color: colors.mutedForeground, fontSize: 12 }}
                  testID="anyliseur-progress"
                >
                  {analysisProgressLabel}
                </Text>
              ) : null
            }
          />
          {fromOpeningEditor ? (
            <View style={styles.openingActions} testID="anyliseur-opening-editor-actions">
              <Pressable
                testID="anyliseur-return-editor"
                onPress={returnToOpeningEditor}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={[styles.chipLabel, { color: colors.foreground }]}>
                  {t('openings.returnToEditor')}
                </Text>
              </Pressable>
              <Pressable
                testID="anyliseur-add-analyzed-line"
                onPress={addAnalyzedLineToPgn}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    borderColor: colors.primary,
                    backgroundColor: colors.secondary,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={[styles.chipLabel, { color: colors.primary }]}>
                  {t('openings.addAnalyzedLine')}
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.openingActions} testID="anyliseur-create-study-actions">
              <Pressable
                testID="anyliseur-create-opening-study"
                onPress={() => setStudyOpen(true)}
                disabled={!reader}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    borderColor: colors.primary,
                    backgroundColor: colors.secondary,
                    opacity: pressed || !reader ? 0.6 : 1,
                  },
                ]}
              >
                <Text style={[styles.chipLabel, { color: colors.primary }]}>
                  {t('openings.createStudyFromHere')}
                </Text>
              </Pressable>
            </View>
          )}
          {replayMode ? reviewPanel : null}
          {showEngineUi ? analysisPanel : null}
        </View>
      ) : null}

      <AnyLyseurExportMenu
        visible={exportMenuOpen}
        onClose={() => setExportMenuOpen(false)}
        includeEvals={includeEvals}
        onIncludeEvalsChange={setIncludeEvals}
        onCopyPgn={() => void onCopyPgn()}
        onDownloadPgn={onDownloadPgn}
        onCopyFen={() => void onCopyFen()}
        onDownloadFen={onDownloadFen}
      />

      {!fromOpeningEditor ? (
        <CreateOpeningStudyModal
          visible={studyOpen}
          initialFen={reader?.game.initialFen ?? game?.initialFen ?? ''}
          currentFen={reader?.currentFen ?? game?.initialFen ?? ''}
          sansFromStart={
            reader
              ? analyzedLineSans({
                  game: reader.game,
                  explorationOriginNodeId: null,
                  currentNodeId: reader.currentNodeId,
                })
              : []
          }
          onCancel={() => setStudyOpen(false)}
          onCreated={(session, side) => {
            setParkedOpeningEditor({
              session,
              commentDraft: '',
              side,
              originNodeId: session.snapshot.currentNodeId,
              kind: 'new-study',
            });
            setStudyOpen(false);
            persistPosition();
            router.push(
              `/openings/annotate?folderId=${encodeURIComponent(session.folderId)}&name=${encodeURIComponent(session.snapshot.displayName)}` as Href,
            );
          }}
        />
      ) : null}
    </ChessScreenScaffold>
  );
}

const styles = StyleSheet.create({
  input: {
    width: '100%',
    minHeight: 110,
    maxHeight: 160,
    borderWidth: 1,
    borderRadius: DesignTokens.radius.md,
    padding: 10,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  loadBtn: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: DesignTokens.radius.md,
  },
  loadText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  error: {
    color: '#c44',
    fontSize: 13,
    lineHeight: 18,
    width: '100%',
    textAlign: 'center',
  },
  empty: {
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  importPanel: {
    gap: 10,
    width: '100%',
    marginBottom: 8,
  },
  readerWrap: { width: '100%', gap: 8, alignItems: 'center' },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    maxWidth: 560,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    borderRadius: DesignTokens.radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipLabel: {
    fontSize: 12,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  analysisPanel: {
    width: '100%',
    maxWidth: 560,
    gap: 10,
    alignItems: 'center',
  },
  openingActions: {
    width: '100%',
    maxWidth: 560,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  status: {
    fontSize: 12,
    textAlign: 'center',
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  compareBox: {
    width: '100%',
    borderWidth: 1,
    borderRadius: DesignTokens.radius.md,
    padding: DesignTokens.spacing.md,
    gap: 4,
  },
});
