/**
 * Compact full-screen placeholder used while Stage 2–6 features are built.
 */
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';

type Props = {
  title: string;
  description: string;
  /** Extra lines under the description (limitations / next stage). */
  notes?: string[];
};

export function ComingSoonScreen({ title, description, notes }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom;

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingTop: topPad + 12,
          paddingBottom: bottomPad + 12,
        },
      ]}
    >
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Retour"
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
        <Text style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}>Retour</Text>
      </Pressable>

      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.desc, { color: colors.mutedForeground }]}>{description}</Text>
        {notes?.map((n) => (
          <Text key={n} style={[styles.note, { color: colors.mutedForeground }]}>
            • {n}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 18, gap: 20 },
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
  body: { gap: 10, marginTop: 24 },
  title: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  desc: { fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  note: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 },
});
