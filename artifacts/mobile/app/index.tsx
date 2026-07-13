import React from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useColors } from '@/hooks/useColors';

interface ModeCard {
  id: string;
  route: Href;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const MODES: ModeCard[] = [
  {
    id: 'classic',
    route: '/classic' as Href,
    title: 'Partie classique',
    description: 'Joue une partie complète contre Stockfish, à la voix ou au doigt.',
    icon: 'game-controller-outline',
  },
  {
    id: 'openings',
    route: '/openings' as Href,
    title: 'Ouvertures',
    description: 'Affronte un adversaire qui suit tes répertoires PGN importés.',
    icon: 'book-outline',
  },
  {
    id: 'blind',
    route: '/blind' as Href,
    title: 'Séquences à l’aveugle',
    description: 'Mémorise une séquence dictée, puis reconstruis-la sur l’échiquier.',
    icon: 'eye-off-outline',
  },
  {
    id: 'puzzles',
    route: '/puzzles' as Href,
    title: 'Problèmes / Visualisation',
    description: 'Résous des problèmes Lichess à vue ou à l’aveugle, hors-ligne.',
    icon: 'extension-puzzle-outline',
  },
];

export default function MainMenu() {
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
        { paddingTop: topPad + 20, paddingBottom: bottomPad + 20 },
      ]}
    >
      <View style={styles.brand}>
        <Image source={require('@/assets/images/icon.png')} style={styles.logo} />
        <Text style={[styles.title, { color: colors.foreground }]}>AnyChess</Text>
        <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
          Choisis un mode de jeu
        </Text>
      </View>

      <View style={styles.cards}>
        {MODES.map((mode) => (
          <Pressable
            key={mode.id}
            onPress={() => router.push(mode.route)}
            testID={`menu-${mode.id}`}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <View style={[styles.iconWrap, { backgroundColor: colors.primary }]}>
              <Ionicons name={mode.icon} size={26} color={colors.primaryForeground} />
            </View>
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>{mode.title}</Text>
              <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>
                {mode.description}
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
  root: {
    paddingHorizontal: 18,
    gap: 26,
  },
  brand: {
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 16,
  },
  title: {
    fontSize: 30,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  cards: {
    gap: 14,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
  },
  cardDesc: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 17,
  },
});
