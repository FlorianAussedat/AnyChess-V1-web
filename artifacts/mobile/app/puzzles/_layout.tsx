import { Stack } from 'expo-router';

export default function PuzzlesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="records" />
      <Stack.Screen name="defends-nulle" />
      <Stack.Screen name="defends-nulle-play" />
      <Stack.Screen name="finales-theoriques" />
      <Stack.Screen name="finales-theoriques-play" />
    </Stack>
  );
}
