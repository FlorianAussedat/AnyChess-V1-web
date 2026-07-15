import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { defaultKeyValueStorage } from '@/lib/storage';
import { MoveNamingRecordsStore, type MoveNamingRecords } from '@/lib/moveNaming/MoveNamingRecords';

const store = new MoveNamingRecordsStore(defaultKeyValueStorage);
export default function VisualisationRecordsScreen() {
  const colors = useColors();
  const [records, setRecords] = useState<MoveNamingRecords>({});
  const load = useCallback(() => store.load().then(setRecords).catch(() => setRecords({})), []);
  useEffect(() => { load(); }, [load]);
  const reset = () => Alert.alert('Effacer les records ?', 'Cette action est irréversible.', [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Effacer', style: 'destructive', onPress: () => store.reset().then(load) },
  ]);
  return <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, gap: 12, backgroundColor: colors.background }}>
    <Text style={{ color: colors.foreground, fontSize: 25, fontWeight: '700' }}>Records</Text>
    <Text style={{ color: colors.mutedForeground }}>Nommer le coup — meilleur score en 60 secondes</Text>
    {Array.from({ length: 10 }, (_, i) => i + 1).map((seconds) => <View key={seconds} style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 13, borderWidth: 1, borderColor: colors.border, borderRadius: 10 }}><Text style={{ color: colors.foreground }}>{seconds} s par coup</Text><Text style={{ color: colors.foreground }}>{records[seconds] ?? 0}</Text></View>)}
    <Pressable onPress={reset} style={{ padding: 14, borderRadius: 10, backgroundColor: '#a33', alignItems: 'center' }}><Text style={{ color: '#fff' }}>Réinitialiser les records</Text></Pressable>
  </ScrollView>;
}
