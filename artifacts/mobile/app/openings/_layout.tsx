import { Stack } from 'expo-router';

/**
 * Nested navigator for the Openings mode (folder list → folder detail).
 * Game play against a repertoire is Stage 3; this stage only manages PGN
 * repertoire folders and imported files.
 */
export default function OpeningsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[folderId]" />
    </Stack>
  );
}
