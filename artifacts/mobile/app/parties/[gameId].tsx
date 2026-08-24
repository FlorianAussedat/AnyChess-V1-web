/**
 * Lecteur de parties — renders UniversalChessWorkspace for imported games
 * or direct workspace sessions (e.g. from analysis overlay route).
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { ChessScreenScaffold } from '@/components/game/ChessScreenScaffold';
import { UniversalChessWorkspace } from '@/components/workspace/UniversalChessWorkspace';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { useBoardCoordinates } from '@/hooks/useBoardCoordinates';
import { useCancelSpeechOnLeave } from '@/hooks/useCancelSpeechOnLeave';
import { useColors } from '@/hooks/useColors';
import { usePreferences } from '@/hooks/usePreferences';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import {
  computeBoardSize,
  fitBoardSizeToViewport,
} from '@/lib/game/boardSize';
import {
  gameLibraryStore,
  gamePlayersTitle,
  gameSubtitle,
  type ImportedChessGame,
} from '@/lib/gameLibrary';
import {
  getEndgameAnalysisOverlay,
} from '@/lib/endgameTraining';
import {
  getTheoreticalAnalysisOverlay,
} from '@/lib/theoreticalEndgame';
import type { ChessWorkspacePayload, WorkspaceMove, AnalysisMarker } from '@/lib/workspace/types';
import { initialOrientationFromFen } from '@/lib/workspace/boardOrientation';
import {
  getChessWorkspaceSession,
} from '@/lib/workspace/WorkspaceSessionRegistry';
import { Chess } from 'chess.js';

/** Chrome reserved outside the board (header, controls, move list, etc.) */
const READER_RESERVED_CHROME = 360;

/** Derive workspace payload from an imported game + optional overlay metadata. */
function payloadFromGame(
  game: ImportedChessGame,
  t: (key: import('@/lib/i18n').MessageKey) => string,
): ChessWorkspacePayload {
  const moves: WorkspaceMove[] = game.moves.map((move, index) => ({
    ply: move.ply,
    san: move.san,
    fenBefore: index === 0 ? game.initialFen : game.moves[index - 1]!.fenAfter,
    fenAfter: move.fenAfter,
    playedBy:
      (index + (game.initialFen.split(' ')[1] === 'b' ? 1 : 0)) % 2 === 0
        ? 'white'
        : 'black',
    comment: move.comment,
  }));

  const resultRaw = game.headers.result ?? '*';
  let resultType: ChessWorkspacePayload['result'] = undefined;
  if (resultRaw === '1-0')
    resultType = { type: 'win', reason: 'checkmate', raw: resultRaw };
  else if (resultRaw === '0-1')
    resultType = { type: 'loss', reason: 'checkmate', raw: resultRaw };
  else if (resultRaw === '1/2-1/2')
    resultType = { type: 'draw', raw: resultRaw };
  else resultType = { type: 'unfinished', raw: resultRaw };

  return {
    schemaVersion: 1,
    workspaceMode: 'reader',
    source: 'manual-pgn',
    title: gamePlayersTitle(game.headers) || t('parties.reader'),
    subtitle: gameSubtitle(game) || undefined,
    initialFen: game.initialFen,
    pgn: game.source.rawPgn,
    moves,
    orientation: initialOrientationFromFen(game.initialFen),
    result: resultType,
    metadata: {
      gameId: game.id,
      hasVariations: game.hasVariations,
    },
  };
}

/** Enrich with endgame overlay (markers + evaluations). */
function applyEndgameOverlay(
  base: ChessWorkspacePayload,
  overlay: ReturnType<typeof getEndgameAnalysisOverlay>,
): ChessWorkspacePayload {
  if (!overlay) return base;
  const markers: AnalysisMarker[] = [];
  if (overlay.firstMajorTurn) {
    markers.push({
      id: 'endgame-objective-lost',
      ply: overlay.firstMajorTurn.playerMoveNumber,
      type: 'objective-lost',
      label: overlay.firstMajorTurn.message,
    });
  }
  // Build evaluations from timeline
  const startStm = overlay.startFen.split(' ')[1] === 'b' ? 'black' : 'white';
  const player = overlay.orientation;
  const evaluations: ChessWorkspacePayload['evaluations'] = [];
  let playerMoveNum = 0;
  let mover: 'white' | 'black' = startStm;
  for (let i = 0; i < overlay.moveSans.length; i++) {
    if (mover === player) {
      playerMoveNum += 1;
      const point = overlay.timeline.find((p) => p.playerMoveNumber === playerMoveNum);
      if (point) {
        const evalEntry: NonNullable<ChessWorkspacePayload['evaluations']>[number] = {
          ply: i + 1,
          evaluation:
            point.mateIn != null
              ? { type: 'mate', value: point.mateIn, perspective: 'white' }
              : { type: 'cp', value: point.scoreCp, perspective: 'white' },
        };
        evaluations.push(evalEntry);
      }
    }
    mover = mover === 'white' ? 'black' : 'white';
  }
  return {
    ...base,
    workspaceMode: 'analysis',
    source: 'defend-draw',
    orientation: overlay.orientation,
    playerColor: overlay.orientation,
    markers,
    evaluations,
  };
}

/** Enrich with theoretical overlay. */
function applyTheoreticalOverlay(
  base: ChessWorkspacePayload,
  overlay: ReturnType<typeof getTheoreticalAnalysisOverlay>,
): ChessWorkspacePayload {
  if (!overlay) return base;
  const markers: AnalysisMarker[] = [];
  if (overlay.firstTheoreticalLoss) {
    markers.push({
      id: 'theoretical-objective-lost',
      ply: overlay.firstTheoreticalLoss.playerMoveNumber,
      type: 'objective-lost',
      label: overlay.firstTheoreticalLoss.message,
    });
  }
  return {
    ...base,
    workspaceMode: 'analysis',
    source: 'theoretical-endgame',
    orientation: overlay.orientation,
    playerColor: overlay.orientation,
    markers,
  };
}

export default function GameReaderScreen() {
  const { gameId, sessionId } = useLocalSearchParams<{
    gameId?: string;
    sessionId?: string;
  }>();
  const router = useRouter();
  const colors = useColors();
  const { t } = useTranslation();
  const { contentTop, contentBottom } = useAppSafeInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  useCancelSpeechOnLeave('/parties');

  const [game, setGame] = useState<ImportedChessGame | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If we have a direct workspace session, no need to load a game
    if (sessionId) {
      setLoading(false);
      return;
    }
    if (!gameId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void gameLibraryStore.getGame(String(gameId)).then((g) => {
      if (!cancelled) {
        setGame(g);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [gameId, sessionId]);

  const boardSize = useMemo(() => {
    const wide = computeBoardSize(windowWidth, 'wide');
    return fitBoardSizeToViewport(
      wide,
      windowHeight,
      READER_RESERVED_CHROME + contentTop + contentBottom,
    );
  }, [windowWidth, windowHeight, contentTop, contentBottom]);

  // ── Direct workspace session (no game library needed) ──────────────────────
  if (!loading && sessionId) {
    const session = getChessWorkspaceSession(String(sessionId));
    if (!session) {
      return (
        <ChessScreenScaffold
          title={t('parties.reader')}
          onBack={() => router.back()}
          testID="game-reader-missing-session"
        >
          <Text style={{ color: colors.foreground }}>Session introuvable.</Text>
          <Pressable onPress={() => router.replace('/parties' as Href)}>
            <Text style={{ color: colors.primary }}>{t('parties.backToLibrary')}</Text>
          </Pressable>
        </ChessScreenScaffold>
      );
    }
    return (
      <ReaderBody
        payload={session.payload}
        title={session.payload.title}
        subtitle={session.payload.subtitle}
        boardSize={boardSize}
        onBack={() => router.back()}
      />
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
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

  // ── Game from library ──────────────────────────────────────────────────────
  const endgameOverlay = getEndgameAnalysisOverlay(game.id);
  const theoreticalOverlay = getTheoreticalAnalysisOverlay(game.id);
  let payload = payloadFromGame(game, t);
  if (endgameOverlay) payload = applyEndgameOverlay(payload, endgameOverlay);
  else if (theoreticalOverlay) payload = applyTheoreticalOverlay(payload, theoreticalOverlay);

  return (
    <ReaderBody
      payload={payload}
      title={payload.title}
      subtitle={payload.subtitle}
      boardSize={boardSize}
      onBack={() => router.back()}
      endOfGameExtra={
        <Pressable
          onPress={() => router.replace('/parties' as Href)}
          style={{ marginTop: DesignTokens.spacing.sm }}
        >
          <Text style={{ color: colors.primary }}>{t('parties.backToLibrary')}</Text>
        </Pressable>
      }
    />
  );
}

function ReaderBody({
  payload,
  title,
  subtitle,
  boardSize,
  onBack,
  endOfGameExtra,
}: {
  payload: ChessWorkspacePayload;
  title: string;
  subtitle?: string;
  boardSize: number;
  onBack: () => void;
  endOfGameExtra?: React.ReactNode;
}) {
  const [showBoard, setShowBoard] = useState(true);
  const [showMoves, setShowMoves] = useState(true);

  return (
    <ChessScreenScaffold
      title={title}
      subtitle={subtitle}
      onBack={onBack}
      testID="game-reader"
    >
      <UniversalChessWorkspace
        payload={payload}
        boardSize={boardSize}
        showBoard={showBoard}
        setShowBoard={setShowBoard}
        showMoves={showMoves}
        setShowMoves={setShowMoves}
      />
      {endOfGameExtra}
    </ChessScreenScaffold>
  );
}
