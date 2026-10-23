/** Read-only readiness check. No authentication, project creation, or .env writes. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { validatePreviewPublicEnv } = require('../lib/app/previewBuild.cjs');
const { resolveAndroidVariant } = require('../lib/app/androidVariants.cjs');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function checkPreviewBuild({ env = process.env, local = false, requireEas = false, hook = false } = {}) {
  if (hook && env.EAS_BUILD_PROFILE !== 'preview') return { skipped: true };
  const profile = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8')).build.preview;
  const selected = { ...env };
  if (local) {
    // Read only the two public fields; never load server or signing credentials.
    const file = path.join(root, '.env');
    const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    for (const line of text.split('\n')) {
      const match = line.match(/^(EXPO_PUBLIC_SUPABASE_URL|EXPO_PUBLIC_SUPABASE_ANON_KEY)=(.*)$/);
      if (match && !selected[match[1]]) selected[match[1]] = match[2].trim();
    }
    for (const [key, value] of Object.entries(profile.env)) if (!selected[key]) selected[key] = value;
  }
  validatePreviewPublicEnv(selected);
  if (profile.developmentClient !== false || profile.environment !== 'preview' ||
      profile.credentialsSource !== 'remote' || profile.android.buildType !== 'apk') {
    throw Error('Invalid Preview EAS profile');
  }
  const config = resolveAndroidVariant('preview', selected).expo;
  const associated = Boolean(config.extra.eas?.projectId && config.owner);
  if ((hook || requireEas) && !associated) throw Error('Configure ANYCHESS_PREVIEW_EAS_PROJECT_ID and ANYCHESS_PREVIEW_EAS_OWNER before EAS Build');
  return { skipped: false, associated };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = checkPreviewBuild({ local: process.argv.includes('--local'), hook: process.argv.includes('--eas-hook'), requireEas: process.argv.includes('--require-eas') });
    if (!result.skipped) {
      console.log('[anychess preview] shared public project and anon role verified locally; no remote validation performed.');
      console.log(`[anychess preview] EAS association ${result.associated ? 'configured (authorization not checked)' : 'pending'}.`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
