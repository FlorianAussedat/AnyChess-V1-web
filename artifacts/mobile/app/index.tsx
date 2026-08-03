/**
 * Rewrite main menu: Tactiques + Visualisation + Quiz Ouverture + version label.
 * Brand icons from Major Update 0.0.2 visual pack.
 */
import React from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { formatAppVersionLabel } from '@/lib/app/version';
import { BrandAssets } from '@/constants/BrandAssets';
import type { ImageSourcePropType } from 'react-native';

interface ModeCard {
  id: Exclude<keyof typeof BrandAssets.modes, 'target'>;
  route: Href;
  title: string;
  description: string;
  icon: ImageSourcePropType;
}

const MODES: ModeCard[] = [
  {
    id: 'classic',
    route: '/classic' as Href,
    title: 'Partie classique',
    description: 'Joue une partie complète contre Stockfish, à la voix ou au doigt.',
    icon: BrandAssets.modes.classic,
  },
  {
    id: 'openings',
    route: '/openings' as Href,
    title: 'Ouvertures',
    description: 'Joue contre ton répertoire ou continue une ligne PGN importée.',
    icon: BrandAssets.modes.openings,
  },
  {
    id: 'blind',
    route: '/blind' as Href,
    title: 'Séquences à l’aveugle',
    description: 'Mémorise une séquence dictée, puis reconstruis-la sur l’échiquier.',
    icon: BrandAssets.modes.blind,
  },
  {
    id: 'puzzles',
    route: '/puzzles' as Href,
    title: 'Tactiques',
    description: 'Résous des problèmes Lichess à vue ou à l’aveugle, hors-ligne.',
    icon: BrandAssets.modes.puzzles,
  },
  {
    id: 'visualisation',
    route: '/visualisation' as Href,
    title: 'Visualisation',
    description: 'Suivi mental de position et reconnaissance rapide de coups.',
    icon: BrandAssets.modes.visualisation,
  },
  {
    id: 'quiz-ouverture',
    route: '/quiz-ouverture' as Href,
    title: 'Quiz Ouverture',
    description: 'Nomme ou construis des ouvertures à partir de la base ECO.',
    icon: BrandAssets.modes['quiz-ouverture'],
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
        <Image source={BrandAssets.logoMark} style={styles.logo} />
        <Text style={styles.titleRow}>
          <Text style={[styles.titleAny, { color: colors.foreground }]}>Any</Text>
          <Text style={styles.titleChess}>Chess</Text>
        </Text>
        <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
          Jouer. Apprendre. Visualiser.
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
            <View style={styles.iconWrap}>
              <Image source={mode.icon} style={styles.modeIcon} resizeMode="contain" />
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

      <Text
        style={[styles.version, { color: colors.mutedForeground }]}
        accessibilityLabel={formatAppVersionLabel()}
        testID="app-version-label"
      >
        {formatAppVersionLabel()}
      </Text>
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
    width: 88,
    height: 88,
    borderRadius: 20,
  },
  titleRow: {
    marginTop: 4,
  },
  titleAny: {
    fontSize: 32,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.4,
  },
  titleChess: {
    fontSize: 32,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.4,
    color: '#F5A623',
  },
  tagline: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  cards: {
    gap: 14,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 76,
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  modeIcon: {
    width: 54,
    height: 54,
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
  version: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    letterSpacing: 0.2,
  },
});
