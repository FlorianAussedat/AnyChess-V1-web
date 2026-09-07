/**
 * AnyLyseur — analyseur de parties / positions.
 * Même cœur Lecteur (useGameReader) + Stockfish via AnalysisController.
 * Conserve gameId / nodeId / FEN / variation / flip avec le Lecteur.
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
  computeBoardSize,
  fitBoardSizeToViewport,
} from '@/lib/game/boardSize';
import { gameLibraryStore } from '@/lib/gameLibrary';
import {
  flushSharedGameSession,
  loadSharedGameSession,
  parseReaderPgn,
  readerGameFromImported,
  saveSharedGameSession,
  useGameReader,
  type ReaderGame,
} from '@/lib/gameReader';

const RESERVED_CHROME = 340;

const SAMPLE_PGN = `[Event "Sample"]
[White "White"]
[Black "Black"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 {Ruy Lopez} 4. Ba4 Nf6 *`;

type TabId = 'game' | 'analysis';

export default function GameAnalyzerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    gameId?: string;
    nodeId?: string;
    flipped?: string;
  }>();
  const gameId = typeof params.gameId === 'string' ? params.gameId : '';
  const paramNodeId =
    typeof params.nodeId === 'string' && params.nodeId.length > 0
      ? params.nodeId
      : null;
  const paramFlipped = params.flipped === '1';

  const colors = useColors();
  const { t } = useTranslation();
  const { chessNotation } = usePreferences();
  const { contentTop, contentBottom } = useAppSafeInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { showCoordinates } = useBoardCoordinates();

  const [pgnDraft, setPgnDraft] = useState(SAMPLE_PGN);
  const [game, setGame] = useState<ReaderGame | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('game');
  const [exportStatus, setExportStatus] = useState<string | null>(null);
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
            SAMPLE_PGN,
        );
        setError(null);
        setGame(session.game);
        setRestoreNodeId(paramNodeId ?? session.currentNodeId);
        setRestoreFlipped(paramFlipped || session.boardFlipped);
        setRestoreOrigin(session.explorationOriginNodeId);
      } else if (imported) {
        setPgnDraft(imported.source.rawPgn?.trim() || SAMPLE_PGN);
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
    if (!gameId || !analysis) return;
    const { done, total, running } = analysis.gameProgress;
    if (running || total <= 0 || done < total) return;
    void gameLibraryStore.markAnalyzed(gameId, {
      profileId: analysis.profileId,
      analyzedAt: Date.now(),
    });
  }, [
    gameId,
    analysis?.gameProgress.done,
    analysis?.gameProgress.total,
    analysis?.gameProgress.running,
    analysis?.profileId,
  ]);

  const boardSize = useMemo(() => {
    const wide = computeBoardSize(windowWidth, 'wide');
    return fitBoardSizeToViewport(
      wide,
      windowHeight,
      Math.max(220, RESERVED_CHROME + contentTop + contentBottom),
    );
  }, [windowWidth, windowHeight, contentTop, contentBottom]);

  const evalValue = analysis?.position
    ? { cp: analysis.position.evaluation, mate: analysis.position.mate }
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
    if (!analysis?.arrowsEnabled) return [];
    const best =
      analysis.position?.bestMove ?? analysis.position?.lines[0]?.bestMove;
    if (!best || best.length < 4) return [];
    return [
      {
        from: best.slice(0, 2),
        to: best.slice(2, 4),
        color: colors.primary,
      },
    ];
  }, [analysis?.arrowsEnabled, analysis?.position, colors.primary]);

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

  const openReader = useCallback(() => {
    persistPosition();
    if (gameId) {
      router.replace({
        pathname: '/parties/[gameId]',
        params: {
          gameId,
          nodeId: reader?.currentNodeId ?? '',
          flipped: reader?.boardFlipped ? '1' : '0',
        },
      });
      return;
    }
    router.back();
  }, [persistPosition, gameId, reader, router]);

  const onLoad = () => {
    const result = parseReaderPgn(pgnDraft, { allowEmptyMoves: true });
    if (!result.ok) {
      setGame(null);
      setError(
        result.detail ? `${result.error} ${result.detail}` : result.error,
      );
      return;
    }
    setError(null);
    setGame(result.game);
  };

  const onExport = async () => {
    if (!game || !analysis) return;
    const main = collectMainLineNodes(game);
    const rawPgn = game.rawPgn ?? game.source?.rawPgn ?? pgnDraft;
    const fenBeforeByNodeId: Record<string, string> = {};
    for (const n of main) fenBeforeByNodeId[n.nodeId] = n.fenBefore;
    const enriched = exportEnrichedPgn({
      rawPgn,
      nodes: analysis.gameNodes,
      mainLineNodeIds: main.map((n) => n.nodeId),
      fenBeforeByNodeId,
    });
    const ok = await copyToClipboard(enriched);
    setExportStatus(
      ok ? t('parties.anyliseurExportDone') : t('parties.anyliseurExportFail'),
    );
  };

  const onImport = useCallback(() => {
    if (gameId) {
      router.push('/parties' as Href);
      return;
    }
    onLoad();
  }, [gameId, router, pgnDraft]);

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
      onExport={() => void onExport()}
      onOpenReader={openReader}
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
        lines={analysis?.position?.lines ?? []}
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
      title={t('parties.analyzer')}
      subtitle={t('parties.analyzerSubtitle')}
      onBack={() => {
        persistPosition();
        router.back();
      }}
      testID="game-analyzer"
    >
      {!gameId ? (
        <>
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
        </>
      ) : null}

      {error ? (
        <Text style={styles.error} testID="game-analyzer-error">
          {error}
        </Text>
      ) : null}

      {!game ? (
        <Text
          style={[styles.empty, { color: colors.mutedForeground }]}
          testID="game-analyzer-empty"
        >
          {t('parties.analyzerEmpty')}
        </Text>
      ) : reader ? (
        <View style={styles.readerWrap}>
          <View style={styles.tabs} testID="anyliseur-tabs">
            <Pressable
              testID="anyliseur-tab-game"
              onPress={() => setTab('game')}
              style={[
                styles.tab,
                {
                  backgroundColor:
                    tab === 'game' ? colors.primary : colors.card,
                  borderColor: colors.border,
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
              onPress={() => setTab('analysis')}
              style={[
                styles.tab,
                {
                  backgroundColor:
                    tab === 'analysis' ? colors.primary : colors.card,
                  borderColor: colors.border,
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

          {tab === 'game' ? (
            <SharedGameReaderView
              reader={reader}
              boardSize={boardSize}
              showCoordinates={showCoordinates}
              showPlayers
              showNotation
              showToolbar={false}
              toolbarSlot={toolbar}
              arrows={arrows}
              onSquarePress={onSquarePress}
              selectedSquare={touchSelected}
              legalDots={legalDests}
              topSlot={
                <EvalBalanceBar
                  value={evalValue}
                  depth={analysis?.position?.depth}
                  loading={analysis?.engineStatus === 'analyzing'}
                />
              }
              bottomSlot={
                analysis?.gameProgress.running ? (
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
          ) : (
            analysisPanel
          )}
        </View>
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
