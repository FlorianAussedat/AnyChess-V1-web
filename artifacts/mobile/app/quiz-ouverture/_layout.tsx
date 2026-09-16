import { Stack } from 'expo-router';

export default function QuizOuvertureLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="quelle" />
      <Stack.Screen name="culture" />
    </Stack>
  );
}
