import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
const runtime = new URL('./settingsUiRuntime.ts', import.meta.url).href;
const overrides = new Set([
  'expo-router',
  '@expo/vector-icons',
  'expo-document-picker',
  '@/hooks/useCloudAccount',
  '@/hooks/useAppSafeInsets',
  '@/hooks/useTranslation',
  '@/hooks/useColors',
  '@/hooks/useAudioSettings',
  '@/hooks/useBoardCoordinates',
  '@/lib/openings/confirmAction',
  '@/components/SoundToggle',
  '@/components/pgn/PgnTranslationSettingsSection',
  '@/lib/engines',
  '@/hooks/usePersistedActivity',
  '@/hooks/useActiveSessionBack',
]);
export async function resolve(specifier, context, nextResolve) {
  if (
    overrides.has(specifier) ||
    /(?:^|\/)SpeechService(?:\.ts)?$/.test(specifier)
  )
    return { url: runtime, shortCircuit: true };
  if (specifier === '@react-native-community/slider')
    return {
      url: new URL('./sliderUiRuntime.ts', import.meta.url).href,
      shortCircuit: true,
    };
  if (specifier === 'react-native')
    return {
      url: new URL('./settingsNativeRuntime.ts', import.meta.url).href,
      shortCircuit: true,
    };
  if (specifier === '@/constants/designTokens')
    return {
      url: new URL('../../../constants/designTokens.ts', import.meta.url).href,
      shortCircuit: true,
    };
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('/lib/moves/MoveProviders.ts'))
    return {
      format: 'module',
      source: transformSync(readFileSync(new URL(url), 'utf8'), {
        loader: 'ts',
        format: 'esm',
      }).code,
      shortCircuit: true,
    };
  return nextLoad(url, context);
}
