import React, { useEffect, useRef, useState } from 'react';
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
import { repertoireService, type ParsedRepertoire } from '@/lib/repertoire';

/**
 * Opening Game play route.
 *
 * Loads the merged repertoire for `folderId`, then hosts an isolated
 * OpeningGameProvider (separate from Classic GameContext).
 *
 * Query: /openings/play?folderId=…&color=w|b
 */
export default function OpeningPlayRoute() {
  const colors = useColors();
  const { top: topPad } = useAppSafeInsets();
  const router = useRouter();

  const { folderId, color } = useLocalSearchParams<{
    folderId: string;
    color?: string;
  }>();

  const initialColor: PlayerColor = color === 'b' ? 'b' : 'w';

  const [repertoire, setRepertoire] = useState<ParsedRepertoire | null>(null);
  const [repertoireName, setRepertoireName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!folderId) {
        setError('Dossier manquant.');
        setLoading(false);
        return;
      }
      try {
        await repertoireService.ensureLoaded();
        const folder = repertoireService.getFolder(folderId);
        if (!folder) {
          setError('Répertoire introuvable.');
          setLoading(false);
          return;
        }
        const { repertoire: rep, fileCount, issues } =
          await repertoireService.buildFolderRepertoire(folderId);
        if (fileCount === 0 || rep.positionCount === 0) {
          setError(
            issues[0]?.message ??
              'Ce répertoire ne contient aucune position jouable. Importe d’abord un PGN.',
          );
          setLoading(false);
          return;
        }
        if (!cancelled) {
          setRepertoire(rep);
          setRepertoireName(folder.name);
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
  }, [folderId]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: topPad + 6 }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={{ color: colors.mutedForeground, marginTop: 12 }}>
          Préparation de la partie…
        </Text>
      </View>
    );
  }

  if (error || !repertoire) {
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
    <OpeningGameProvider repertoire={repertoire} repertoireName={repertoireName}>
      <ApplyInitialColor initialColor={initialColor}>
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
