// Local to navigation renderer tests; never loaded by Expo or other test processes.
const runtime = new URL('./uiRuntime.ts', import.meta.url).href;
const mobile = new URL('../../../', import.meta.url);
const overrides = new Set([
  'expo-router', 'expo-image', '@expo/vector-icons',
  '@/hooks/useCloudAccount', '@/hooks/useAppSafeInsets', '@/hooks/useTranslation',
  '@/hooks/useColors', '@/constants/BrandAssets', '@/components/SoundToggle',
]);
export async function resolve(specifier, context, nextResolve) {
  if (overrides.has(specifier)) return { url: runtime, shortCircuit: true };
  if (specifier === 'react-native') return {
    url: new URL('./nativeRuntime.ts', import.meta.url).href,
    shortCircuit: true,
  };
  if (specifier === '@/constants/designTokens') return {
    url: new URL('constants/designTokens.ts', mobile).href, shortCircuit: true,
  };
  return nextResolve(specifier, context);
}
