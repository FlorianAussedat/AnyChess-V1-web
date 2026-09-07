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
  collectMainLineNodes,
  exportEnrichedPgn,
  formatAnyLyseurEval,
  uciToSan,
  useAnyLyseurAnalysis,
  type AnalysisProfileId,
} from '@/lib/analysis';
import { formatSanForDisplay } from '@/lib/chess/notation';
import { copyToClipboard } from '@/lib/clipboard';
import {
  anyChessPgnFilename,
  downloadPgnFile,
} from '@/lib/pgn/PgnExporter';
import { pickPgnFile } from '@/lib/repertoire/pickPgnFile';
import {
  computeBoardSize,
  fitBoardSizeToViewport,
} from '@/lib/game/boardSize';
import { gameLibraryStore } from '@/lib/gameLibrary';
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

const RESERVED_CHROME = 340;

type TabId = 'game' | 'analysis';

export default function GameWorkspaceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    gameId?: string;
    nodeId?: string;
    flipped?: string;
    tab?: string;
  }>();
  const gameId = typeof params.gameId === 'string' ? params.gameId : '';
  const paramNodeId =
    typeof params.nodeId === 'string' && params.nodeId.length > 0
      ? params.nodeId
      : null;
  const paramFlipped = params.flipped === '1';
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
  const [showPaste, setShowPaste] = useState(!gameId);
  const [restoreNodeId, setRestoreNodeId] = useState<string | null>(
    paramNodeId,
  );
  const [restoreFlipped, setRestoreFlipped] = useState(paramFlipped);
  const [restoreOrigin, setRestoreOrigin] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(!gameId);

  useEffect(() => {
    return () => {
      void flushSharedGameSession();
    };
  }, []);

  useEffect(() => {
    if (!gameId) {
      setSessionReady(true);
      return;
    }
    let cancelled = false;
    void (async () => {
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
        if (paramNodeId) setRestoreNodeId(paramNodeId);
        if (paramFlipped) setRestoreFlipped(true);
      }
      setSessionReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId, paramNodeId, paramFlipped]);

  const reader = useGameReader({
    game: sessionReady ? game : null,
    initialNodeId: restoreNodeId,
    initialFlipped: restoreFlipped,
    initialExplorationOriginNodeId: restoreOrigin,
    autosaveSession: Boolean(game),
    analysisProfileId: undefined,
  });

  const {
    state: analysis,
    setProfile,
    reanalyze,
    setArrowsEnabled,
    retryEngine,
    classificationInputs,
  } = useAnyLyseurAnalysis({
    game: reader?.game ?? game,
    currentFen: reader?.currentFen ?? null,
    currentNodeId: reader?.currentNodeId ?? null,
    activeLineNodeIds: reader?.activeLineNodeIds ?? [],
  });

  useEffect(() => {
    if (!gameId || !analysis?.mainLineComplete) return;
    void gameLibraryStore.markAnalyzed(gameId, {
      profileId: analysis.profileId,
      analyzedAt: Date.now(),
    });
  }, [gameId, analysis?.mainLineComplete, analysis?.profileId]);

  const boardSize = useMemo(() => {
    const wide = computeBoardSize(windowWidth, 'wide');
    return fitBoardSizeToViewport(
      wide,
      windowHeight,
      Math.max(220, RESERVED_CHROME + contentTop + contentBottom),
    );
  }, [windowWidth, windowHeight, contentTop, contentBottom]);

  const showEngineUi = tab === 'analysis';

  const displayPosition =
    showEngineUi &&
    analysis?.position &&
    reader?.currentFen &&
    analysis.position.fen === reader.currentFen &&
    analysis.position.profileId === analysis.profileId
      ? analysis.position
      : null;

  const evalValue = displayPosition
    ? {
        cp: displayPosition.evaluation,
        mate: displayPosition.mate,
        terminalOutcome: displayPosition.terminalOutcome,
      }
    : null;

  const curvePoints = useMemo((): EvalCurvePoint[] => {
    if (!game || !analysis) return [];
    return collectMainLineNodes(game)
      .map((n) => {
        const nodeAnalysis = analysis.gameNodes[n.nodeId];
        if (!nodeAnalysis) return null;
        return { nodeId: n.nodeId, analysis: nodeAnalysis };
      })
      .filter((p): p is EvalCurvePoint => p != null);
  }, [game, analysis]);

  const arrows = useMemo(() => {
    if (!showEngineUi) return [];
    if (!analysis?.arrowsEnabled || !displayPosition) return [];
    if (displayPosition.terminalOutcome) return [];
    const best =
      displayPosition.bestMove ?? displayPosition.lines[0]?.bestMove;
    if (!best || best.length < 4) return [];
    try {
      const chess = new Chess(displayPosition.fen);
      const from = best.slice(0, 2);
      const to = best.slice(2, 4);
      const promo = best.length > 4 ? best[4] : undefined;
      const ok = chess
        .moves({ verbose: true })
        .some(
          (m) =>
            m.from === from &&
            m.to === to &&
            (!promo || m.promotion === promo),
        );
      if (!ok) return [];
      return [{ from, to, color: colors.primary }];
    } catch {
      return [];
    }
  }, [
    showEngineUi,
    analysis?.arrowsEnabled,
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
    if (gameId) {
      router.push('/parties' as Href);
      return;
    }
    try {
      const picked = await pickPgnFile();
      if (picked?.text) {
        setPgnDraft(picked.text);
        setShowPaste(true);
        return;
      }
    } catch {
      /* fall through — paste still available */
    }
    setShowPaste(true);
  }, [gameId, router]);

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
      profileId={analysis?.profileId ?? 'normal'}
      onProfileChange={onProfileChange}
      onImport={onImport}
      onExport={() => setExportMenuOpen(true)}
      showEngineControls={showEngineUi}
      canReturnToOrigin={canReturnToOrigin}
      onReturnToOrigin={() => reader.returnToExplorationOrigin()}
    />
  ) : null;

  const currentNode =
    reader?.currentNodeId && game
      ? game.nodesById[reader.currentNodeId]
      : null;
  const playedSan = classificationInputs?.playedMoveSan
    ? formatSanForDisplay(classificationInputs.playedMoveSan, chessNotation)
    : null;
  const bestSan =
    classificationInputs?.bestMoveUci && currentNode
      ? (() => {
          const san = uciToSan(
            currentNode.fenBefore,
            classificationInputs.bestMoveUci,
          );
          return san ? formatSanForDisplay(san, chessNotation) : null;
        })()
      : null;

  const engineUnavailable =
    analysis?.engineStatus === 'unavailable' ||
    analysis?.engineStatus === 'error';

  const analysisPanel = (
    <View style={styles.analysisPanel} testID="anyliseur-analysis-panel">
      <Text style={[styles.status, { color: colors.mutedForeground }]}>
        {engineUnavailable
          ? t('parties.anyliseurUnavailable')
          : analysis?.engineStatus === 'analyzing'
            ? t('parties.anyliseurAnalyzing')
            : analysis?.engineStatus === 'initializing'
              ? t('parties.anyliseurInitializing')
              : t('parties.anyliseurReady')}
        {analysis?.gameProgress.running
          ? ` · ${t('parties.anyliseurProgress', {
              done: String(analysis.gameProgress.done),
              total: String(analysis.gameProgress.total),
            })}`
          : ''}
      </Text>

      {engineUnavailable ? (
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
      ) : null}

      {classificationInputs && (playedSan || bestSan) ? (
        <View
          style={[
            styles.compareBox,
            { borderColor: colors.border, backgroundColor: colors.card },
          ]}
          testID="anyliseur-played-vs-best"
        >
          <Text style={{ color: colors.foreground }}>
            {t('parties.anyliseurPlayed')}: {playedSan ?? '—'}
          </Text>
          <Text style={{ color: colors.primary }}>
            {t('parties.anyliseurBest')}: {bestSan ?? '—'}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
            {t('parties.anyliseurBefore')}:{' '}
            {formatAnyLyseurEval({
              cp: classificationInputs.evalBefore,
              mate: classificationInputs.mateBefore,
            })}
            {' · '}
            {t('parties.anyliseurAfter')}:{' '}
            {formatAnyLyseurEval({
              cp: classificationInputs.evalAfter,
              mate: classificationInputs.mateAfter,
            })}
          </Text>
        </View>
      ) : null}

      <EngineLinesPanel
        fen={reader?.currentFen ?? game?.initialFen ?? ''}
        lines={displayPosition?.lines ?? []}
        notation={chessNotation}
      />
      <EvalCurve
        points={curvePoints}
        activeNodeId={reader?.currentNodeId ?? null}
        onSelectNode={(nodeId) => reader?.goToNode(nodeId)}
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
        router.back();
      }}
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
                  // @ts-expect-error web cursor
                  cursor: 'pointer',
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
                  // @ts-expect-error web cursor
                  cursor: 'pointer',
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
            showPlayers
            showNotation={tab === 'game'}
            showToolbar={false}
            toolbarSlot={toolbar}
            arrows={arrows}
            onSquarePress={onSquarePress}
            selectedSquare={touchSelected}
            legalDots={legalDests}
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
              showEngineUi && analysis?.gameProgress.running ? (
                <Text
                  style={{ color: colors.mutedForeground, fontSize: 12 }}
                  testID="anyliseur-progress"
                >
                  {t('parties.anyliseurProgress', {
                    done: String(analysis.gameProgress.done),
                    total: String(analysis.gameProgress.total),
                  })}
                </Text>
              ) : null
            }
          />
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
