import React from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { ModeScreenShell } from '@/components/ModeScreenShell';
import { blindStyles } from '@/components/blind/blindStyles';
import { useBlindSequence } from '@/contexts/BlindSequenceContext';
import { halfMoveCount } from '@/lib/blind';
import {
  BLIND_SPEED_MAX,
  BLIND_SPEED_MIN,
  DEFAULT_BLIND_SPEED,
  type BlindPerspective,
} from '@/lib/blind';
import { BrandAssets } from '@/constants/BrandAssets';

const FULL_MOVE_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1);

export function BlindSettingsPhase() {
  const colors = useColors();
  const {
    submode,
    perspective,
    fullMoves,
    speed,
    setPerspective,
    setFullMoves,
    setSpeed,
    startSession,
    isGenerating,
    generateError,
    backToHub,
  } = useBlindSequence();

  const title =
    submode === 'watch-recite' ? 'Regarder puis réciter' : 'Écouter puis reconstruire';

  return (
    <ModeScreenShell title={title} onBack={backToHub}>
      <ScrollView contentContainerStyle={blindStyles.settingsBody}>
        <Text style={[blindStyles.sectionLabel, { color: colors.mutedForeground }]}>
          Perspective (bas de l’échiquier)
        </Text>
        <View style={blindStyles.row}>
          {(
            [
              { id: 'white' as BlindPerspective, label: 'Blancs', icon: BrandAssets.sides.white },
              { id: 'black' as BlindPerspective, label: 'Noirs', icon: BrandAssets.sides.black },
              { id: 'random' as BlindPerspective, label: 'Aléatoire', icon: BrandAssets.sides.random },
            ] as const
          ).map((opt) => {
            const active = perspective === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => setPerspective(opt.id)}
                style={[
                  blindStyles.choice,
                  {
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                    flexDirection: 'row',
                    gap: 6,
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                ]}
              >
                <Image source={opt.icon} style={{ width: 20, height: 20 }} />
                <Text
                  style={{
                    fontFamily: 'Inter_600SemiBold',
                    fontSize: 12,
                    color: active ? colors.primaryForeground : colors.foreground,
                    textAlign: 'center',
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[blindStyles.hint, { color: colors.mutedForeground }]}>
          Les Blancs jouent toujours en premier. 1 coup complet = 1 coup Blanc + 1 coup Noir.
        </Text>

        <Text style={[blindStyles.sectionLabel, { color: colors.mutedForeground }]}>
          Coups complets (1–20)
        </Text>
        <View style={blindStyles.chipRow}>
          {FULL_MOVE_OPTIONS.map((n) => {
            const active = fullMoves === n;
            return (
              <Pressable
                key={n}
                onPress={() => setFullMoves(n)}
                style={[
                  blindStyles.chip,
                  {
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={{
                    fontFamily: 'Inter_600SemiBold',
                    fontSize: 12,
                    color: active ? colors.primaryForeground : colors.foreground,
                  }}
                >
                  {n}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[blindStyles.hint, { color: colors.mutedForeground }]}>
          {fullMoves} coups complets = {halfMoveCount(fullMoves)} demi-coups
          {fullMoves === 20 ? ' (maximum)' : ''}
        </Text>

        <Text style={[blindStyles.sectionLabel, { color: colors.mutedForeground }]}>
          Vitesse ({BLIND_SPEED_MIN}–{BLIND_SPEED_MAX})
        </Text>
        <View style={blindStyles.sliderBlock}>
          <View style={blindStyles.sliderLabels}>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12 }}>
              Lent
            </Text>
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>
              {speed}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12 }}>
              Rapide
            </Text>
          </View>
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={BLIND_SPEED_MIN}
            maximumValue={BLIND_SPEED_MAX}
            step={1}
            value={speed}
            onValueChange={(v) => setSpeed(v)}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.primary}
            accessibilityLabel="Vitesse"
          />
        </View>
        <Text style={[blindStyles.hint, { color: colors.mutedForeground }]}>
          {speed <= 3
            ? 'Lent — plus de temps entre les coups'
            : speed >= 8
              ? 'Rapide — enchaînement serré'
              : `Vitesse ${speed} (défaut ${DEFAULT_BLIND_SPEED})`}
          {submode === 'listen-reconstruct'
            ? ' · dictée orale'
            : ' · observation visuelle'}
        </Text>

        {!!generateError && (
          <Text style={{ color: colors.destructive, fontFamily: 'Inter_400Regular', fontSize: 13 }}>
            {generateError}
          </Text>
        )}

        <Pressable
          onPress={() => startSession()}
          disabled={isGenerating}
          style={({ pressed }) => [
            blindStyles.cta,
            { backgroundColor: colors.primary, opacity: isGenerating || pressed ? 0.7 : 1 },
          ]}
        >
          {isGenerating ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <>
              <Ionicons name="play" size={20} color={colors.primaryForeground} />
              <Text style={[blindStyles.ctaLabel, { color: colors.primaryForeground }]}>
                Générer la séquence
              </Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </ModeScreenShell>
  );
}
