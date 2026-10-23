const PUBLIC_PROJECT_URL = 'https://zqfxnzwtptepulmgpxhb.supabase.co';
const CONFIRM_PAGE_URL = 'https://sparkly-paprenjak-65f499.netlify.app/auth/confirm';
const PUBLIC_VARIABLES = new Set(['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_APP_CLIENT', 'EXPO_PUBLIC_AUTH_CONFIRM_URL']);

/** Build-time only. Never include this Node helper in the application bundle. */
function validatePreviewPublicEnv(env, nowMs = Date.now()) {
  const errors = [];
  if (env.ANYCHESS_VARIANT !== 'preview') errors.push('ANYCHESS_VARIANT must be preview');
  if (env.EXPO_PUBLIC_APP_CLIENT !== 'preview') errors.push('EXPO_PUBLIC_APP_CLIENT must be preview');
  if (env.EXPO_PUBLIC_AUTH_CONFIRM_URL !== CONFIRM_PAGE_URL) errors.push('Preview must use the shared confirmation site');
  if (env.EXPO_PUBLIC_SUPABASE_URL !== PUBLIC_PROJECT_URL) errors.push('Preview must use the shared Supabase project URL');
  const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
  try {
    const parts = key.split('.');
    if (parts.length !== 3) throw Error();
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (payload.role !== 'anon' || payload.ref !== 'zqfxnzwtptepulmgpxhb' ||
        typeof payload.exp !== 'number' || payload.exp * 1000 <= nowMs) throw Error();
  } catch {
    errors.push('EXPO_PUBLIC_SUPABASE_ANON_KEY must be the existing project anon JWT with a future expiration');
  }
  for (const [name, value] of Object.entries(env)) {
    if (!name.startsWith('EXPO_PUBLIC_')) continue;
    let role;
    try { role = JSON.parse(Buffer.from(String(value).split('.')[1] || '', 'base64url').toString('utf8')).role; } catch {}
    if (!PUBLIC_VARIABLES.has(name) || /SECRET|PASSWORD|SERVICE_ROLE|DEEPL|ADMIN|TOKEN/i.test(name) ||
        /sb_secret_|service_role|DEEPL_API_KEY/i.test(String(value)) || (role && role !== 'anon')) {
      errors.push(`Forbidden public credential variable: ${name}`);
    }
  }
  if (errors.length) throw new Error(`[anychess preview] ${errors.join('; ')}. Values omitted.`);
  return { projectMatches: true, anonRole: true };
}
module.exports = { validatePreviewPublicEnv, PUBLIC_PROJECT_URL, CONFIRM_PAGE_URL };
