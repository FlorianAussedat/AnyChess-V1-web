import React from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { BrandAssets } from '@/constants/BrandAssets';
import type { ImageSourcePropType } from 'react-native';

type ExerciseCard = {
  id: string;
  route: Href;
  title: string;
  description: string;
  icon: ImageSourcePropType;
};

const EXERCISES: ExerciseCard[] = [
  {
    id: 'quelle',
    route: '/quiz-ouverture/quelle' as Href,
    title: 'Quelle ouverture ?',
    description: 'Reconnais le nom de l’ouverture à partir de la ligne jouée (base ECO).',
    icon: BrandAssets.modes['quiz-ouverture'],
  },
  {
    id: 'construis',
    route: '/quiz-ouverture/construis' as Href,
    title: 'Construis l’ouverture',
    description: 'Dicte la ligne jusqu’à la position qui identifie l’ouverture demandée.',
    icon: BrandAssets.modes.openings,
  },
];

export default function QuizOuvertureHub() {
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

      <Text style={[styles.title, { color: colors.foreground }]}>Quiz Ouverture</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Utilise la base d’ouvertures ECO locale — indépendante de tes répertoires PGN.
      </Text>

      <View style={styles.cards}>
        {EXERCISES.map((ex) => (
          <Pressable
            key={ex.id}
            testID={`quiz-${ex.id}`}
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
            <View style={styles.iconWrap}>
              <Image source={ex.icon} style={styles.modeIcon} resizeMode="contain" />
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
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  modeIcon: {
    width: 48,
    height: 48,
  },
  cardTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  cardDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
});