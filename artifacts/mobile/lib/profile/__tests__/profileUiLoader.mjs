const runtime = new URL('./profileUiRuntime.ts', import.meta.url).href;
const overrides = new Set([
  'expo-router',
  '@expo/vector-icons',
  '@/hooks/useUserProfile',
  '@/hooks/useCloudAccount',
  '@/hooks/useAppSafeInsets',
  '@/hooks/useTranslation',
  '@/hooks/useColors',
  '@/lib/cloud',
  '@/lib/storage',
  '@/lib/repertoire',
  '@/lib/records/AnyChessRecords',
  '@/components/cloud/CloudAccountSection',
  '@/components/SoundToggle',
]);
export async function resolve(specifier, context, nextResolve) {
  if (overrides.has(specifier)) return { url: runtime, shortCircuit: true };
  if (specifier === 'react-native')
    return {
      url: new URL('./profileNativeRuntime.ts', import.meta.url).href,
      shortCircuit: true,
    };
  if (specifier === '@/constants/designTokens')
    return {
      url: new URL('../../../constants/designTokens.ts', import.meta.url).href,
      shortCircuit: true,
    };
  return nextResolve(specifier, context);
}
