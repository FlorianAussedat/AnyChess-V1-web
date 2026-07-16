import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BackButton } from '@/components/BackButton';
import { useColors } from '@/hooks/useColors';
import { defaultKeyValueStorage } from '@/lib/storage';
import {
  MoveNamingRecordsStore,
  type MoveNamingRecords,
} from '@/lib/moveNaming/MoveNamingRecords';

const store = new MoveNamingRecordsStore(defaultKeyValueStorage);

export default function VisualisationRecordsScreen() {
  const colors = useColors();
  const router = useRouter();
  const [records, setRecords] = useState<MoveNamingRecords>({});
  const load = useCallback(() => store.load().then(setRecords).catch(() => setRecords({})), []);
  useEffect(() => {
    load();
  }, [load]);

  const reset = () =>
    Alert.alert(
      'Réinitialiser tous les records ?',
      'Cette action supprimera tous les meilleurs scores enregistrés.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réinitialiser',
          style: 'destructive',
          onPress: () => store.reset().then(load),
        },
      ],
    );

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { backgroundColor: colors.background }]}
    >
      <BackButton onPress={() => router.back()} label="Retour" />
      <Text style={[styles.title, { color: colors.foreground }]}>Records</Text>
      <Text style={{ color: colors.mutedForeground }}>
        Nommer le coup — meilleur score en 60 secondes
      </Text>
      {Array.from({ length: 10 }, (_, i) => i + 1).map((seconds) => (
        <View
          key={seconds}
          style={[styles.row, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.foreground }}>{seconds} s par coup</Text>
          <Text style={{ color: colors.foreground }}>{records[seconds] ?? 0}</Text>
        </View>
      ))}
      <Pressable onPress={reset} style={styles.resetBtn} testID="reset-records">
        <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
          Réinitialiser les scores
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
    padding: 13,
    borderWidth: 1,
    borderRadius: 10,
  },
  resetBtn: {
    marginTop: 8,
    padding: 12,
    alignItems: 'center',
    opacity: 0.85,
  },
});
