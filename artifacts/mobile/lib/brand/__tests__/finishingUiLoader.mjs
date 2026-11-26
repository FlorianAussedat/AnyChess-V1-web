const runtime = new URL('../../navigation/__tests__/uiRuntime.ts', import.meta.url).href;
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'react-native')
    return { url: new URL('./finishingNative.ts', import.meta.url).href, shortCircuit: true };
  if (
    [
      '@expo/vector-icons',
      'expo-image',
      'expo-router',
      '@/hooks/useColors',
      '@/hooks/useTranslation',
    ].includes(specifier)
  )
    return { url: runtime, shortCircuit: true };
  return nextResolve(specifier, context);
}
