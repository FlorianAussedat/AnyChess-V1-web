import { Stack } from 'expo-router';

/**
 * Nested navigator for the Openings mode:
 *   hub → review / learn / manage → play / continue / study.
 */
export default function OpeningsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="review" />
      <Stack.Screen name="learn" />
      <Stack.Screen name="manage" />
      <Stack.Screen name="study" />
      <Stack.Screen name="[folderId]" />
      <Stack.Screen name="play" />
      <Stack.Screen name="continue" />
    </Stack>
  );
}
