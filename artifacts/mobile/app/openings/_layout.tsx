import { Stack } from 'expo-router';

/**
 * Nested navigator for the Openings mode:
 *   folder list → folder detail → play / continue-line.
 */
export default function OpeningsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[folderId]" />
      <Stack.Screen name="play" />
      <Stack.Screen name="continue" />
    </Stack>
  );
}
