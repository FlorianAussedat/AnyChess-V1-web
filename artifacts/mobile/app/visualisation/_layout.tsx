import { Stack } from 'expo-router';

export default function VisualisationLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="mental" />
      <Stack.Screen name="nommer" />
      <Stack.Screen name="jouer" />
      <Stack.Screen name="records" />
    </Stack>
  );
}
