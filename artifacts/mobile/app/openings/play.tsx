import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import {
  OpeningGameProvider,
  useOpeningGame,
} from '@/contexts/OpeningGameContext';
import type { PlayerColor } from '@/contexts/OpeningGameContext';
import { OpeningGameScreen } from '@/components/OpeningGameScreen';
import {
  repertoireService,
  pickMixedLine,
  filterEntriesByReviewSide,
  mixedTrainingKey,
  sideToPlayerColor,
  type ParsedRepertoire,
  type ReviewSideFilter,
  type MixedRepertoireEntry,
} from '@/lib/repertoire';
import { continueLineRecentStorage } from '@/lib/continueLine/recentStore';

type LoadedSession = {
  repertoire: ParsedRepertoire;
  repertoireName: string;
  playerColor: PlayerColor;
  folderId: string;
  pathKey: string;
  nonce: number;
};

/**
 * Opening Game play route.
 *
 * Single folder: /openings/play?folderId=…&color=w|b&sideLocked=1
 * Mixed review:  /openings/play?folderIds=…&side=all|white|black
 *
 * When the repertoire side is known, the side picker is skipped and the
 * board is oriented from that side.
 */
export default function OpeningPlayRoute() {
  const colors = useColors();
  const { top: topPad } = useAppSafeInsets();
  const router = useRouter();

  const {
    folderId,
    folderIds,
    color,
    side: sideParam,
    sideLocked: sideLockedParam,
  } = useLocalSearchParams<{
    folderId?: string;
    folderIds?: string;
    color?: string;
    side?: string;
    sideLocked?: string;
  }>();

  const reviewSide: ReviewSideFilter | null =
    sideParam === 'white' || sideParam === 'black' || sideParam === 'all'
      ? sideParam
      : null;

  const mixedFolderIds = folderIds
    ? folderIds.split(',').map((s) => s.trim()).filter(Boolean)
    : folderId
      ? [folderId]
      : [];

  const isMixedReview = mixedFolderIds.length > 1 || reviewSide != null;
  const sideLocked =
    sideLockedParam === '1' ||
    sideLockedParam === 'true' ||
    isMixedReview ||
    Boolean(folderId && color);

  const [session, setSession] = useState<LoadedSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionKey, setSessionKey] = useState(0);
  const entriesRef = useRef<MixedRepertoireEntry[]>([]);
  const recentKeyRef = useRef('');

  const loadEntries = useCallback(async (): Promise<MixedRepertoireEntry[]> => {
    await repertoireService.ensureLoaded();
    const entries: MixedRepertoireEntry[] = [];
    for (const id of mixedFolderIds) {
      const folder = repertoireService.getFolder(id);
      if (!folder) throw new Error('Répertoire introuvable.');
      if (!folder.side) {
        throw new Error(
          `« ${folder.name} » n’a pas de côté enregistré. Ouvre le répertoire et indique Blancs ou Noirs.`,
        );
      }
      const { repertoire: rep, fileCount, issues } =
        await repertoireService.buildFolderRepertoire(id);
      if (fileCount === 0 || rep.positionCount === 0) {
        throw new Error(
          issues[0]?.message ??
            `« ${folder.name} » ne contient aucune position jouable.`,
        );
      }
      entries.push({ folder, repertoire: rep });
    }
    return reviewSide ? filterEntriesByReviewSide(entries, reviewSide) : entries;
  }, [mixedFolderIds.join(','), reviewSide]);

  const pickSession = useCallback(
    async (entries: MixedRepertoireEntry[], nonce: number): Promise<LoadedSession> => {
      if (entries.length === 0) {
        throw new Error('Aucun répertoire à réviser.');
      }

      if (!isMixedReview && entries.length === 1) {
        const entry = entries[0]!;
        const side = entry.folder.side!;
        const initialColor: PlayerColor =
          color === 'b' || color === 'w'
            ? color
            : sideToPlayerColor(side);
        return {
          repertoire: entry.repertoire,
          repertoireName: entry.folder.name,
          playerColor: initialColor,
          folderId: entry.folder.id,
          pathKey: entry.folder.id,
          nonce,
        };
      }

      const recentKey = mixedTrainingKey(entries.map((e) => e.folder.id));
      recentKeyRef.current = recentKey;
      const recent = await continueLineRecentStorage.getRecentPathIds(recentKey);
      const pick = pickMixedLine(entries, { recentPathIds: recent });
      if (!pick) {
        throw new Error('Impossible de tirer une ligne dans la sélection.');
      }
      const pathKey = `${pick.folderId}:${pick.path.id}`;
      await continueLineRecentStorage.pushRecentPathId(recentKey, pathKey);
      return {
        repertoire: pick.repertoire,
        repertoireName: pick.repertoireName,
        playerColor: sideToPlayerColor(pick.side),
        folderId: pick.folderId,
        pathKey,
        nonce,
      };
    },
    [isMixedReview, color],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (mixedFolderIds.length === 0) {
        setError('Dossier manquant.');
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const entries = await loadEntries();
        entriesRef.current = entries;
        const next = await pickSession(entries, sessionKey);
        if (!cancelled) {
          setSession(next);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [mixedFolderIds.join(','), reviewSide, sessionKey]);

  const onRequestNextExercise = useCallback(() => {
    setSessionKey((k) => k + 1);
  }, []);

  if (loading && !session) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: topPad + 6 }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={{ color: colors.mutedForeground, marginTop: 12 }}>
          Préparation de la partie…
        </Text>
      </View>
    );
  }

  if (error || !session) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: colors.background, paddingTop: topPad + 6, paddingHorizontal: 20 },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
        >
          <Ionicons name="chevron-back" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
      </View>
    );
  }

  return (
    <OpeningGameProvider
      key={`${session.pathKey}:${session.playerColor}:${session.nonce}`}
      repertoire={session.repertoire}
      repertoireName={session.repertoireName}
    >
      <ApplyInitialColor initialColor={session.playerColor}>
        <OpeningGameScreen
          sideLocked={sideLocked}
          onNewGameOverride={isMixedReview ? onRequestNextExercise : undefined}
        />
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
    applied.current = false;
  }, [initialColor]);

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
  iconBtn: {
    position: 'absolute',
    top: 80,
    left: 14,
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
});
