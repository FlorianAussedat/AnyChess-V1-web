import { Stack } from 'expo-router';

/**
 * Chess game layout — single screen, no tab bar, no header.
 * The game screen handles its own safe-area insets.
 */
export default function ChessLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
