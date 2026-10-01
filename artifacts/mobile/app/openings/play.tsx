import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import {
  OpeningGameProvider,
  useOpeningGame,
} from '@/contexts/OpeningGameContext';
import type { PlayerColor } from '@/contexts/OpeningGameContext';
import { OpeningGameScreen } from '@/components/OpeningGameScreen';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  applyReviewPick,
  ephemeralSessionForOrigin,
  leaveEphemeralOpeningExercise,
  listReviewPoolEntries,
  pickReviewLineFromMemory,
  pickUnmasteredLearningPath,
  repertoireFromSans,
  repertoireService,
  commitOpeningReviewAttempt,
  openingMasteryStore,
  setEphemeralOpeningSession,
  trainingPathsForPgn,
  type EphemeralOpeningSession,
  type ParsedRepertoire,
} from '@/lib/repertoire';
import {
  reviewResultFromAttempt,
  type OpeningReviewAttemptSnapshot,
} from '@/lib/repertoire/openingReviewAttempt';
import {
  presentPgnCommentDialog,
  presentReviewLineBilan,
} from '@/lib/openings/presentReviewLineBilan';
import { tMsg } from '@/lib/i18n';
import {
  DEFAULT_STRENGTH_BAND_ID,
  getStrengthBand,
} from '@/lib/difficulty/StockfishStrengthBands';
import { preferencesStore } from '@/lib/preferences';

/**
 * Opening Game play route.
 *
 * Loads an ephemeral selected line when present, otherwise the folder repertoire.
 */
export default function OpeningPlayRoute() {
  const colors = useColors();
  const { t } = useTranslation();
  const { contentTop } = useAppSafeInsets();
  const router = useRouter();

  const { folderId, color, band, fileId, gameIndex, from } = useLocalSearchParams<{
    folderId: string;
    fileId?: string;
    gameIndex?: string;
    color?: string;
    band?: string;
    from?: string;
  }>();
  const fromOrigin = Array.isArray(from) ? from[0] : from;

  const preferredBand =
    preferencesStore.getPreferences().stockfishStrengthBandId ||
    DEFAULT_STRENGTH_BAND_ID;
  const strengthBandId =
    typeof band === 'string' && band.length > 0
      ? getStrengthBand(band).id
      : getStrengthBand(preferredBand).id;

  const [repertoire, setRepertoire] = useState<ParsedRepertoire | null>(null);
  const [repertoireName, setRepertoireName] = useState('');
  const [sourcePgn, setSourcePgn] = useState('');
  const [playerColor, setPlayerColor] = useState<PlayerColor>(color === 'b' ? 'b' : 'w');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lineKey, setLineKey] = useState(0);
  const originRef = useRef<'review' | 'study' | null>(
    fromOrigin === 'review' || fromOrigin === 'study' ? fromOrigin : null,
  );
  const parkedRef = useRef<EphemeralOpeningSession | null>(null);
  const autoUnmasteredRef = useRef(false);
  const [revisionIds, setRevisionIds] = useState<{ fileId: string; pathId: string } | null>(null);
  const [lineLabel, setLineLabel] = useState<string | null>(null);
  const [trainingPathSans, setTrainingPathSans] = useState<string[] | null>(null);

  const rememberParked = useCallback((session: EphemeralOpeningSession) => {
    parkedRef.current = session;
    autoUnmasteredRef.current = session.autoUnmastered === true;
    originRef.current = session.origin;
    if (session.origin === 'review') {
      setRevisionIds({ fileId: session.fileId, pathId: session.pathId });
    } else {
      setRevisionIds(null);
    }
    setLineLabel(session.lineName?.trim() || session.displayName);
    setTrainingPathSans(session.pathSans);
  }, []);

  const applyLine = useCallback(
    (rep: ParsedRepertoire, name: string, pgn: string, nextColor: PlayerColor) => {
      setRepertoire(rep);
      setRepertoireName(name);
      setSourcePgn(pgn);
      setPlayerColor(nextColor);
      setError(null);
      setLoading(false);
      setLineKey((k) => k + 1);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        await repertoireService.ensureLoaded();
        const eph = ephemeralSessionForOrigin(fromOrigin);
        if (eph) {
          originRef.current = eph.origin;
          rememberParked(eph);
          if (cancelled) return;
          applyLine(
            repertoireFromSans(eph.pathSans),
            eph.displayName,
            eph.sourcePgn,
            eph.side === 'black' ? 'b' : 'w',
          );
          return;
        }
        if (fromOrigin === 'review') {
          const pick = pickReviewLineFromMemory(
            listReviewPoolEntries(
              repertoireService.getFolders(),
              repertoireService.getAllFiles(),
            ),
          );
          if (pick) {
            const session = applyReviewPick(pick, 'review');
            rememberParked(session);
            originRef.current = 'review';
            if (cancelled) return;
            applyLine(
              repertoireFromSans(session.pathSans),
              session.displayName,
              session.sourcePgn,
              session.side === 'black' ? 'b' : 'w',
            );
            return;
          }
        }
        if (!folderId) {
          setError(t('openings.folderIdMissing'));
          setLoading(false);
          return;
        }
        const folder = repertoireService.getFolder(folderId);
        if (!folder) {
          setError(t('openings.repertoireNotFound'));
          setLoading(false);
          return;
        }
        const { repertoire: rep, fileCount, issues } =
          await repertoireService.buildFolderRepertoire(
            folderId,
            fileId,
            gameIndex === undefined ? undefined : Number(gameIndex),
          );
        if (fileCount === 0 || rep.positionCount === 0) {
          setError(issues[0]?.message ?? t('openings.playEmpty'));
          setLoading(false);
          return;
        }
        if (!cancelled) {
          applyLine(
            rep,
            folder.name,
            repertoireService.getFolderCombinedPgn(
              folderId,
              fileId,
              gameIndex === undefined ? undefined : Number(gameIndex),
            ),
            folder.side === 'black' ? 'b' : color === 'b' ? 'b' : 'w',
          );
          setLineLabel(null);
          setTrainingPathSans(null);
        }
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
  }, [applyLine, color, fileId, folderId, fromOrigin, gameIndex, rememberParked, t]);

  const requestNextLine = useCallback(() => {
    const eph = parkedRef.current;
    if (originRef.current === 'study' && eph?.autoUnmastered) {
      const file = repertoireService.getFile(eph.fileId);
      if (!file) return;
      const pick = pickUnmasteredLearningPath(
        file.id,
        trainingPathsForPgn(file.pgnText),
        (key) => openingMasteryStore.historyByKey(key),
      );
      if (!pick) return;
      const next: EphemeralOpeningSession = {
        ...eph,
        pathSans: pick.sans,
        pathId: pick.id,
        autoUnmastered: true,
      };
      setEphemeralOpeningSession(next);
      rememberParked(next);
      applyLine(
        repertoireFromSans(pick.sans),
        eph.displayName,
        eph.sourcePgn,
        eph.side === 'black' ? 'b' : 'w',
      );
      return;
    }
    if (originRef.current !== 'review') return;
    const entries = listReviewPoolEntries(
      repertoireService.getFolders(),
      repertoireService.getAllFiles(),
    );
    const pick = pickReviewLineFromMemory(entries);
    if (!pick) return;
    const session = applyReviewPick(pick, 'review');
    rememberParked(session);
    applyLine(
      repertoireFromSans(session.pathSans),
      session.displayName,
      session.sourcePgn,
      session.side === 'black' ? 'b' : 'w',
    );
  }, [applyLine, rememberParked]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: contentTop }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={{ color: colors.mutedForeground, marginTop: 12 }}>
          {t('openings.preparingGame')}
        </Text>
      </View>
    );
  }

  if (error || !repertoire) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: colors.background, paddingTop: contentTop, paddingHorizontal: 20 },
        ]}
      >
        <ScreenHeader
          onBack={() => {
            leaveEphemeralOpeningExercise();
            router.back();
          }}
          title={t('openings.opening')}
        />
        <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
      </View>
    );
  }

  return (
    <OpeningGameProvider
      key={lineKey}
      repertoire={repertoire}
      repertoireName={repertoireName}
      sourcePgn={sourcePgn}
      strengthBandId={strengthBandId}
      lineLabel={lineLabel}
      trainingPathSans={trainingPathSans}
      reviewFileId={revisionIds?.fileId ?? parkedRef.current?.fileId ?? null}
      onPersistReviewResult={
        originRef.current !== 'review'
          ? undefined
          : async (stats: OpeningReviewAttemptSnapshot) => {
              await commitOpeningReviewAttempt(
                'review',
                revisionIds?.fileId,
                revisionIds?.pathId,
                reviewResultFromAttempt(stats),
              );
            }
      }
      onRequestNextLine={
        originRef.current === 'review' || autoUnmasteredRef.current ? requestNextLine : undefined
      }
    >
      <ApplyInitialColor initialColor={playerColor}>
        <ReviewAttemptRecorder
          origin={originRef.current}
          fileId={revisionIds?.fileId}
          pathId={revisionIds?.pathId}
        />
        <OpeningGameScreen />
      </ApplyInitialColor>
    </OpeningGameProvider>
  );
}

function ReviewAttemptRecorder({
  origin,
  fileId,
  pathId,
}: {
  origin: 'review' | 'study' | null;
  fileId?: string;
  pathId?: string;
}) {
  const { trainingState, reviewStats, getFinalLineComment, openingLabel } = useOpeningGame();
  const bilanKeyRef = useRef<string | null>(null);

  useEffect(() => {
    bilanKeyRef.current = null;
  }, [pathId]);

  useEffect(() => {
    if (origin !== 'review' || trainingState !== 'lineComplete' || !fileId || !pathId) {
      return;
    }
    const key = `${fileId}:${pathId}`;
    void (async () => {
      const totals = await commitOpeningReviewAttempt(
        'review',
        fileId,
        pathId,
        reviewResultFromAttempt(reviewStats),
      );
      if (bilanKeyRef.current === key) return;
      bilanKeyRef.current = key;
      const finalComment = getFinalLineComment();
      presentReviewLineBilan({
        lineName: openingLabel ?? '',
        stats: reviewStats,
        totalAttempts: totals.totalAttempts,
        totalSuccesses: totals.totalSuccesses,
        hasFinalComment: Boolean(finalComment),
        onShowFinalComment: finalComment
          ? () => presentPgnCommentDialog(tMsg('openings.finalCommentTitle'), finalComment)
          : undefined,
      });
    })();
  }, [fileId, getFinalLineComment, openingLabel, origin, pathId, reviewStats, trainingState]);

  return null;
}

function ApplyInitialColor({
  initialColor,
  children,
}: {
  initialColor: PlayerColor;
  children: React.ReactNode;
}) {
  const { playerColor, changeColor, ready } = useOpeningGame();
  const applied = useRef(false);

  useEffect(() => {
    if (!ready || applied.current) return;
    if (initialColor !== playerColor) {
      changeColor(initialColor);
    }
    applied.current = true;
  }, [ready, initialColor, playerColor, changeColor]);

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  error: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
});
