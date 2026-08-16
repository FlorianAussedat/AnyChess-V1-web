import { Stack } from 'expo-router';

export default function PartiesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[gameId]" />
    </Stack>
  );
}
