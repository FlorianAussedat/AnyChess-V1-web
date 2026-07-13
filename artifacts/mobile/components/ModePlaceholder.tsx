import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';

interface Props {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  message: string;
}

/**
 * Temporary screen for modes that are implemented in later stages.
 * Keeps navigation working end-to-end from the main menu.
 */
export function ModePlaceholder({ title, icon, message }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: topPad + 6 }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="chevron-back" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      </View>

      <View style={styles.body}>
        <Ionicons name={icon} size={56} color={colors.mutedForeground} />
        <Text style={[styles.message, { color: colors.mutedForeground }]}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 24,
  },
  message: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 22,
  },
});
