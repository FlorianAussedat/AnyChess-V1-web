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
  getEphemeralOpeningSession,
  listReviewPoolEntries,
  pickReviewLineFromMemory,
  repertoireFromSans,
  repertoireService,
  type ParsedRepertoire,
} from '@/lib/repertoire';
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
    from === 'review' || from === 'study' ? from : null,
  );

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
        const eph = getEphemeralOpeningSession();
        if (eph && (from === 'review' || from === 'study' || eph.origin === 'review' || eph.origin === 'study')) {
          originRef.current = eph.origin;
          if (cancelled) return;
          applyLine(
            repertoireFromSans(eph.pathSans),
            eph.displayName,
            eph.sourcePgn,
            eph.side === 'black' ? 'b' : 'w',
          );
          return;
        }
        if (from === 'review') {
          const pick = pickReviewLineFromMemory(
            listReviewPoolEntries(
              repertoireService.getFolders(),
              repertoireService.getAllFiles(),
            ),
          );
          if (pick) {
            const session = applyReviewPick(pick, 'review');
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
  }, [applyLine, color, fileId, folderId, from, gameIndex, t]);

  const requestNextLine = useCallback(() => {
    if (originRef.current !== 'review') return;
    const entries = listReviewPoolEntries(
      repertoireService.getFolders(),
      repertoireService.getAllFiles(),
    );
    const pick = pickReviewLineFromMemory(entries);
    if (!pick) return;
    const session = applyReviewPick(pick, 'review');
    applyLine(
      repertoireFromSans(session.pathSans),
      session.displayName,
      session.sourcePgn,
      session.side === 'black' ? 'b' : 'w',
    );
  }, [applyLine]);

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
        <ScreenHeader onBack={() => router.back()} title={t('openings.opening')} />
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
      onRequestNextLine={originRef.current === 'review' ? requestNextLine : undefined}
    >
      <ApplyInitialColor initialColor={playerColor}>
        <OpeningGameScreen />
      </ApplyInitialColor>
    </OpeningGameProvider>
  );
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
