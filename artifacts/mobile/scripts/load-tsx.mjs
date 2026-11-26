/**
 * Loads .tsx for the Node test runner. Type-only .ts files stay on
 * --experimental-strip-types. `@/` matches the mobile tsconfig paths.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { transformSync } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shims = new Map([
  ['react-native', join(root, 'lib/theoreticalEndgame/__tests__/uiShims/reactNative.ts')],
  ['expo-router', join(root, 'lib/theoreticalEndgame/__tests__/uiShims/expoRouter.ts')],
  ['react-native-svg', join(root, 'lib/theoreticalEndgame/__tests__/uiShims/svg.ts')],
  ['@/hooks/useColors', join(root, 'lib/theoreticalEndgame/__tests__/uiShims/hooks.ts')],
  ['@/hooks/useTranslation', join(root, 'lib/theoreticalEndgame/__tests__/uiShims/hooks.ts')],
  ['@/constants/BrandAssets', join(root, 'lib/theoreticalEndgame/__tests__/uiShims/assets.ts')],
  ['@/constants/designTokens', join(root, 'lib/theoreticalEndgame/__tests__/uiShims/assets.ts')],
  ['@/lib/game/boardSize', join(root, 'lib/theoreticalEndgame/__tests__/uiShims/assets.ts')],
  ['@/lib/cloud/exportAccountPgns', join(root, 'lib/theoreticalEndgame/__tests__/uiShims/exportAccountPgns.ts')],
]);

function useUiShims(parentURL) {
  if (!parentURL) return false;
  return (
    parentURL.includes('/components/') ||
    parentURL.includes('/theoreticalEndgame/ui/') ||
    parentURL.includes('/EndgameEngineStatusBanner.tsx') ||
    parentURL.includes('/uiShims/') ||
    parentURL.includes('/navigation/useSmartBack.ts') ||
    parentURL.includes('/hooks/useHeaderHardwareBack.ts') ||
    parentURL.includes('/hooks/useWebNavigationGuard.ts')
  );
}

function fileCandidate(base) {
  const candidates = [`${base}.ts`, `${base}.tsx`, `${base}.js`, join(base, 'index.ts'), join(base, 'index.tsx')];
  if (existsSync(base) && statSync(base).isFile()) candidates.unshift(base);
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
}

function rewriteBare(specifier) {
  if (!specifier.startsWith('@/')) return null;
  return fileCandidate(join(root, specifier.slice(2)));
}

function rewriteRelative(specifier, parentURL) {
  if (!parentURL || !(specifier.startsWith('./') || specifier.startsWith('../'))) return null;
  if (/\.(tsx?|jsx?|mjs|cjs|json)$/.test(specifier)) return null;
  const parent = fileURLToPath(parentURL.split('?')[0]);
  return fileCandidate(resolvePath(dirname(parent), specifier));
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@react-native-async-storage/async-storage') return { url: pathToFileURL(join(root, 'lib/storage/__tests__/asyncStorageShim.ts')).href, shortCircuit: true };
  if (useUiShims(context.parentURL) && shims.has(specifier)) {
    return {
      url: pathToFileURL(shims.get(specifier)).href,
      shortCircuit: true,
    };
  }
  const found = rewriteBare(specifier) ?? rewriteRelative(specifier, context.parentURL);
  if (found) {
    return {
      url: pathToFileURL(found).href,
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (!url.startsWith('file:') || !url.split('?')[0].endsWith('.tsx')) {
    return nextLoad(url, context);
  }
  const path = fileURLToPath(url);
  const source = readFileSync(path, 'utf8');
  const result = transformSync(source, {
    loader: 'tsx',
    format: 'esm',
    sourcefile: path,
    jsx: 'automatic',
  });
  return {
    format: 'module',
    source: result.code,
    shortCircuit: true,
  };
}
