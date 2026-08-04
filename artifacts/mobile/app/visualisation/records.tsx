import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BackButton } from '@/components/BackButton';
import { useColors } from '@/hooks/useColors';
import { defaultKeyValueStorage } from '@/lib/storage';
import { MoveNamingRecordsStore } from '@/lib/moveNaming/MoveNamingRecords';
import { PlayMoveRecordsStore } from '@/lib/playMove/PlayMoveRecords';

const moveNamingStore = new MoveNamingRecordsStore(defaultKeyValueStorage);
const playMoveStore = new PlayMoveRecordsStore(defaultKeyValueStorage);

export default function VisualisationRecordsScreen() {
  const colors = useColors();
  const router = useRouter();
  const [moveNamingBest, setMoveNamingBest] = useState(0);
  const [playMoveBest, setPlayMoveBest] = useState(0);
  const [legacy, setLegacy] = useState<Record<number, number>>({});

  const load = useCallback(async () => {
    const [mn, pm, leg] = await Promise.all([
      moveNamingStore.loadBest().catch(() => 0),
      playMoveStore.loadBest().catch(() => 0),
      moveNamingStore.load().catch(() => ({}) as Record<number, number>),
    ]);
    setMoveNamingBest(mn);
    setPlayMoveBest(pm);
    setLegacy(leg);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const hasLegacy = Object.values(legacy).some((v) => (v ?? 0) > 0);

  const resetAll = () =>
    Alert.alert(
      'Réinitialiser tous les records ?',
      'Cette action remettra à zéro les records 60 secondes. Les anciens scores par délai (legacy) restent conservés séparément.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réinitialiser',
          style: 'destructive',
          onPress: () =>
            Promise.all([moveNamingStore.reset(), playMoveStore.reset()]).then(load),
        },
      ],
    );

  return (
    <ScrollView contentContainerStyle={[styles.page, { backgroundColor: colors.background }]}>
      <BackButton onPress={() => router.back()} label="Retour" />
      <Text style={[styles.title, { color: colors.foreground }]}>Records</Text>
      <Text style={{ color: colors.mutedForeground }}>
        Meilleurs scores sur 60 secondes — Vision de l’échiquier
      </Text>

      <View style={[styles.row, { borderColor: colors.border }]} testID="record-move-naming-60">
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.foreground, fontWeight: '600' }}>Nommer le coup</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
            Coups correctement nommés / 60 s
          </Text>
        </View>
        <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: '700' }}>
          {moveNamingBest}
        </Text>
      </View>

      <View style={[styles.row, { borderColor: colors.border }]} testID="record-play-move-60">
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.foreground, fontWeight: '600' }}>Jouer le coup</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
            Coups correctement joués / 60 s
          </Text>
        </View>
        <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: '700' }}>
          {playMoveBest}
        </Text>
      </View>

      {hasLegacy ? (
        <View style={styles.legacyBlock}>
          <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
            Anciens records (délai par coup) — conservés, non utilisés par le mode 60 s :
          </Text>
          {Array.from({ length: 10 }, (_, i) => i + 1)
            .filter((s) => (legacy[s] ?? 0) > 0)
            .map((seconds) => (
              <Text key={seconds} style={{ color: colors.mutedForeground, fontSize: 12 }}>
                {seconds} s / coup → {legacy[seconds]}
              </Text>
            ))}
        </View>
      ) : null}

      <Pressable onPress={resetAll} style={styles.resetBtn} testID="reset-records">
        <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
          Réinitialiser les scores 60 s
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, padding: 20, gap: 12 },
  title: { fontSize: 25, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 13,
    borderWidth: 1,
    borderRadius: 10,
    gap: 12,
  },
  legacyBlock: { gap: 4, marginTop: 8, opacity: 0.85 },
  resetBtn: {
    marginTop: 8,
    padding: 12,
    alignItems: 'center',
    opacity: 0.85,
  },
});
