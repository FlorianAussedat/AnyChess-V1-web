import { Stack } from 'expo-router';

export default function PuzzlesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="records" />
      <Stack.Screen name="defends-nulle" />
    </Stack>
  );
}
