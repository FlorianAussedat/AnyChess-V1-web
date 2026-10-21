const runtime = new URL('./fileUiRuntime.ts', import.meta.url).href;
export async function resolve(specifier, context, nextResolve) {
  if (
    [
      'expo-document-picker',
      '@expo/vector-icons',
      '@/hooks/useColors',
      '@/hooks/useTranslation',
      '@/lib/gameLibrary',
    ].includes(specifier)
  )
    return { url: runtime, shortCircuit: true };
  if (specifier === 'react-native')
    return {
      url: new URL('./fileNativeRuntime.ts', import.meta.url).href,
      shortCircuit: true,
    };
  if (specifier === '@/constants/designTokens')
    return {
      url: new URL('../../../constants/designTokens.ts', import.meta.url).href,
      shortCircuit: true,
    };
  return nextResolve(specifier, context);
}
