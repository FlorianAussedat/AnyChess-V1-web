import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useColors } from '@/hooks/useColors';

type ExerciseCard = {
  id: string;
  route: Href;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const EXERCISES: ExerciseCard[] = [
  {
    id: 'mental',
    route: '/visualisation/mental' as Href,
    title: 'Suivi mental de position',
    description: 'Suis une séquence, puis réponds à des questions sur la position.',
    icon: 'eye-outline',
  },
  {
    id: 'nommer',
    route: '/visualisation/nommer' as Href,
    title: 'Nommer le coup',
    description: 'Jeu chronométré : nomme le coup que tu vois sur l’échiquier.',
    icon: 'flash-outline',
  },
  {
    id: 'records',
    route: '/visualisation/records' as Href,
    title: 'Records',
    description: 'Meilleurs scores par délai de réponse (Nommer le coup).',
    icon: 'trophy-outline',
  },
];

export default function VisualisationHub() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.root,
        { paddingTop: topPad + 12, paddingBottom: bottomPad + 20 },
      ]}
    >
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        style={({ pressed }) => [
          styles.back,
          {
            borderColor: colors.border,
            backgroundColor: colors.card,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Ionicons name="chevron-back" size={20} color={colors.foreground} />
        <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}>Menu</Text>
      </Pressable>

      <Text style={[styles.title, { color: colors.foreground }]}>Visualisation</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Deux exercices distincts pour entraîner le suivi mental et la reconnaissance de coups.
      </Text>

      <View style={styles.cards}>
        {EXERCISES.map((ex) => (
          <Pressable
            key={ex.id}
            testID={`viz-${ex.id}`}
            onPress={() => router.push(ex.route)}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <View style={[styles.iconWrap, { backgroundColor: colors.primary }]}>
              <Ionicons name={ex.icon} size={24} color={colors.primaryForeground} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>{ex.title}</Text>
              <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>
                {ex.description}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 18, gap: 16 },
  back: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 44,
  },
  title: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  cards: { gap: 12, marginTop: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 72,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  cardDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
});
