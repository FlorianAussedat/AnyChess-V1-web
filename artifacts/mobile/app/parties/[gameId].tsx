/**
 * Lecteur de parties — board / notation / ply synchronisés via useGameReader.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { ChessScreenScaffold } from '@/components/game/ChessScreenScaffold';
import { BoardCoordinatesToggle } from '@/components/BoardCoordinatesToggle';
import { BoardVisibilityToggle } from '@/components/BoardVisibilityToggle';
import { SharedGameReaderView } from '@/components/gameReader';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useBoardCoordinates } from '@/hooks/useBoardCoordinates';
import { useCancelSpeechOnLeave } from '@/hooks/useCancelSpeechOnLeave';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import { computeBoardSize, fitBoardSizeToViewport } from '@/lib/game/boardSize';
import {
  gameLibraryStore,
  gamePlayersTitle,
  gameSubtitle,
  type ImportedChessGame,
} from '@/lib/gameLibrary';
import {
  getEndgameAnalysisOverlay,
  type EndgameAnalysisPayload,
} from '@/lib/endgameTraining';
import {
  getTheoreticalAnalysisOverlay,
  type TheoreticalAnalysisPayload,
} from '@/lib/theoreticalEndgame';
import type { EvaluationPoint, FirstMajorTurn } from '@/lib/endgameTraining/domain/types';
import { PressureGauge } from '@/lib/endgameTraining/ui/PressureGauge';
import { EvaluationCurve } from '@/lib/endgameTraining/ui/EvaluationCurve';
import { readerGameFromImported, useGameReader } from '@/lib/gameReader';

const READER_RESERVED_CHROME = 300;

function orientationFromGame(game: ImportedChessGame): 'white' | 'black' | null {
  const extra = game.headers as ImportedChessGame['headers'] & {
    orientation?: string;
    Orientation?: string;
  };
  const rawHeader = extra.orientation ?? extra.Orientation;
  if (typeof rawHeader === 'string') {
    const v = rawHeader.trim().toLowerCase();
    if (v === 'black' || v === 'b') return 'black';
    if (v === 'white' || v === 'w') return 'white';
  }
  const pgn = game.source.rawPgn;
  if (!pgn) return null;
  const match = /\[Orientation\s+"?(white|black)"?\]/i.exec(pgn);
  if (!match?.[1]) return null;
  return match[1].toLowerCase() === 'black' ? 'black' : 'white';
}

type UnifiedOverlay = {
  startFen: string;
  orientation: 'white' | 'black';
  moveSans: string[];
  timeline: EvaluationPoint[];
  firstMajorTurn: FirstMajorTurn | null;
};

function fromEndgame(overlay: EndgameAnalysisPayload): UnifiedOverlay {
  return {
    startFen: overlay.startFen,
    orientation: overlay.orientation,
    moveSans: overlay.moveSans,
    timeline: overlay.timeline,
    firstMajorTurn: overlay.firstMajorTurn ?? null,
  };
}

function fromTheoretical(overlay: TheoreticalAnalysisPayload): UnifiedOverlay {
  return {
    startFen: overlay.startFen,
    orientation: overlay.orientation,
    moveSans: overlay.moveSans,
    timeline: overlay.timeline,
    firstMajorTurn: overlay.firstMajorTurn,
  };
}

function evalAtOverlay(
  overlay: UnifiedOverlay,
  ply: number,
): { scoreCp: number; mateIn: number | null } {
  const timeline = overlay.timeline;
  if (timeline.length === 0) return { scoreCp: 0, mateIn: null };

  const stm = overlay.startFen.split(' ')[1] === 'b' ? 'black' : 'white';
  const player = overlay.orientation;
  const played = overlay.moveSans.slice(0, Math.max(0, ply));
  let mover: 'white' | 'black' = stm;
  let playerMoves = 0;
  for (let i = 0; i < played.length; i += 1) {
    if (mover === player) playerMoves += 1;
    mover = mover === 'white' ? 'black' : 'white';
  }

  let best = timeline[0]!;
  for (const point of timeline) {
    if (point.playerMoveNumber <= playerMoves) best = point;
  }
  return { scoreCp: best.scoreCp, mateIn: best.mateIn };
}

export default function GameReaderScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const router = useRouter();
  const colors = useColors();
  const { t } = useTranslation();
  const { contentTop, contentBottom } = useAppSafeInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { showCoordinates, toggleCoordinates } = useBoardCoordinates();
  useCancelSpeechOnLeave();

  const [game, setGame] = useState<ImportedChessGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [boardVisible, setBoardVisible] = useState(true);
  const [movesVisible, setMovesVisible] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!gameId) {
        setLoading(false);
        return;
      }
      const loaded = await gameLibraryStore.getGame(String(gameId));
      if (!cancelled) {
        setGame(loaded);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  useEffect(() => {
    setBoardVisible(true);
    setMovesVisible(true);
  }, [gameId]);

  const endgameOverlay = useMemo(
    () => (game ? getEndgameAnalysisOverlay(game.id) : null),
    [game],
  );
  const theoreticalOverlay = useMemo(
    () => (game ? getTheoreticalAnalysisOverlay(game.id) : null),
    [game],
  );

  const overlay: UnifiedOverlay | null = endgameOverlay
    ? fromEndgame(endgameOverlay)
    : theoreticalOverlay
      ? fromTheoretical(theoreticalOverlay)
      : null;

  const boardOrientation =
    endgameOverlay?.orientation ??
    theoreticalOverlay?.orientation ??
    (game ? orientationFromGame(game) : null) ??
    'white';

  const readerGame = useMemo(() => {
    if (!game) return null;
    return readerGameFromImported({
      id: game.id,
      fingerprint: game.fingerprint,
      headers: game.headers,
      initialFen: game.initialFen,
      moves: game.moves,
      hasVariations: game.hasVariations,
      rawPgn: game.source.rawPgn,
      source: game.source,
    });
  }, [game]);

  const reader = useGameReader({
    game: readerGame,
    initialFlipped: boardOrientation === 'black',
  });

  const gaugeEval = useMemo(() => {
    if (!overlay || !reader) return null;
    return evalAtOverlay(overlay, reader.currentPly);
  }, [overlay, reader]);

  const boardSize = useMemo(() => {
    const wide = computeBoardSize(windowWidth, 'wide');
    const reserved =
      READER_RESERVED_CHROME +
      contentTop +
      contentBottom +
      (boardVisible ? 0 : -120) +
      (movesVisible ? 0 : -80) +
      (overlay ? 80 : 0);
    return fitBoardSizeToViewport(wide, windowHeight, Math.max(220, reserved));
  }, [
    windowWidth,
    windowHeight,
    contentTop,
    contentBottom,
    boardVisible,
    movesVisible,
    overlay,
  ]);

  if (loading) {
    return (
      <ChessScreenScaffold
        title={t('parties.reader')}
        onBack={() => router.back()}
        testID="game-reader-loading"
      >
        <ActivityIndicator color={colors.primary} />
        <Text style={{ color: colors.mutedForeground }}>{t('parties.loading')}</Text>
      </ChessScreenScaffold>
    );
  }

  if (!game) {
    return (
      <ChessScreenScaffold
        title={t('parties.reader')}
        onBack={() => router.back()}
        testID="game-reader-missing"
      >
        <Text style={{ color: colors.foreground }}>{t('parties.notFound')}</Text>
        <Pressable onPress={() => router.replace('/parties' as Href)}>
          <Text style={{ color: colors.primary }}>{t('parties.backToLibrary')}</Text>
        </Pressable>
      </ChessScreenScaffold>
    );
  }

  if (!reader) {
    return (
      <ChessScreenScaffold
        title={t('parties.reader')}
        subtitle={t('parties.parseError')}
        onBack={() => router.back()}
        testID="game-reader-parse-error"
      >
        <Text style={{ color: colors.foreground, textAlign: 'center' }}>
          {t('parties.parseError')}
        </Text>
        <Text style={{ color: colors.mutedForeground, textAlign: 'center' }}>
          {t('parties.parseErrorHint')}
        </Text>
        <Pressable onPress={() => router.replace('/parties' as Href)}>
          <Text style={{ color: colors.primary }}>{t('parties.backToLibrary')}</Text>
        </Pressable>
      </ChessScreenScaffold>
    );
  }

  const title = gamePlayersTitle(game.headers);
  const subtitle = gameSubtitle(game);
  const result = game.headers.result ?? '*';

  return (
    <ChessScreenScaffold
      title={title}
      subtitle={subtitle || t('parties.reader')}
      onBack={() => router.back()}
      testID="game-reader"
      trailing={
        <Pressable
          testID="parties-open-analyzer-from-reader"
          accessibilityRole="button"
          accessibilityLabel={t('parties.openAnalyzer')}
          onPress={() =>
            router.push({
              pathname: '/parties/analyzer',
              params: { gameId: game.id },
            })
          }
          style={[
            styles.headerChip,
            { borderColor: colors.border, backgroundColor: colors.card },
          ]}
        >
          <Text style={[styles.headerChipLabel, { color: colors.foreground }]}>
            {t('parties.analyzer')}
          </Text>
        </Pressable>
      }
    >
      <View style={styles.toggles}>
        <BoardVisibilityToggle
          visible={boardVisible}
          onToggle={() => setBoardVisible(!boardVisible)}
        />
        <BoardCoordinatesToggle
          visible={showCoordinates}
          onToggle={toggleCoordinates}
        />
        <Pressable
          testID="game-reader-toggle-moves"
          onPress={() => setMovesVisible(!movesVisible)}
          style={[styles.movesToggle, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.foreground, fontSize: 12 }}>
            {movesVisible ? t('parties.hideMoves') : t('parties.showMoves')}
          </Text>
        </Pressable>
      </View>

      <SharedGameReaderView
        reader={reader}
        boardSize={boardSize}
        showCoordinates={showCoordinates}
        showBoard={boardVisible}
        showNotation={movesVisible}
        topSlot={
          overlay && gaugeEval ? (
            <View style={styles.analysisTools}>
              <PressureGauge
                scoreCp={gaugeEval.scoreCp}
                mateIn={gaugeEval.mateIn}
                visible
                perspective={overlay.orientation}
                testID="game-reader-pressure-gauge"
              />
              <EvaluationCurve
                timeline={overlay.timeline}
                firstMajorTurn={overlay.firstMajorTurn}
                width={Math.min(boardSize, Math.max(240, windowWidth - 48))}
                testID="game-reader-eval-curve"
              />
            </View>
          ) : null
        }
        bottomSlot={
          reader.currentPly >= reader.totalPly && reader.totalPly > 0 ? (
            <View style={styles.endBlock} testID="game-reader-ended">
              <Text style={[styles.endText, { color: colors.foreground }]}>
                {t('parties.endOfGame', { result })}
              </Text>
              <Pressable
                onPress={() => reader.goToStart()}
                style={[styles.secondaryBtn, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.foreground }}>{t('common.restart')}</Text>
              </Pressable>
              <Pressable onPress={() => router.replace('/parties' as Href)}>
                <Text style={{ color: colors.primary }}>{t('parties.backToLibrary')}</Text>
              </Pressable>
            </View>
          ) : null
        }
      />
    </ChessScreenScaffold>
  );
}

const styles = StyleSheet.create({
  headerChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  headerChipLabel: {
    fontSize: 12,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  toggles: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    width: '100%',
  },
  movesToggle: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  analysisTools: {
    gap: 10,
    alignItems: 'center',
    width: '100%',
  },
  endBlock: { alignItems: 'center', gap: 10, width: '100%' },
  endText: {
    fontSize: 16,
    fontFamily: DesignTokens.typography.weightSemiBold,
    textAlign: 'center',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
});
