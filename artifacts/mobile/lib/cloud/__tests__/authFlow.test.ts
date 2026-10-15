import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { StorageKeys } from '../../storage/StorageKeys.ts';
import {
  isPendingEmailConfirmation,
  mapSupabaseAuthError,
} from '../authErrors.ts';
import { CloudSyncEngine } from '../CloudSyncEngine.ts';
import { resetConfirmationEmailCooldown } from '../confirmCooldown.ts';
import { authClientVariant, authConfirmRedirectUrl, authMailLanguage } from '../supabaseConfig.ts';
import { MemoryCloudAuth, MemoryCloudRemote } from '../MemoryCloud.ts';
import type { CloudAuth, CloudDocument } from '../types.ts';
import { renderConfirmationPage, renderConfirmationSvg } from '../../../../../supabase/functions/auth-confirm/page.ts';
import {
  PUBLIC_CONFIRM_PAGE_URL,
  PUBLIC_LOGO_URL,
  PUBLIC_SUPABASE_URL,
  PUBLIC_VERIFY_URL,
  confirmPageRedirect,
} from '../../../../../supabase/functions/auth-confirm/publicPage.ts';
import {
  CONFIRM_COPY,
  PLAIN_FALLBACK,
  appOpenHref,
  interpretConfirmationLocation,
  languageFromAccept,
  pageClient,
  pageLanguage,
  plainFallback,
  userEmailIsConfirmed,
} from '../../../../../supabase/functions/auth-confirm/outcome.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../../../../');

function repertoire() {
  return JSON.stringify({
    version: 2,
    folders: [],
    files: [{ id: 'keep', filename: 'keep.pgn', pgnText: '1. e4 *' }],
  });
}

describe('supabase auth error codes', () => {
  it('maps the codes GoTrue actually returns, and does not collapse them to rejected', () => {
    assert.equal(
      mapSupabaseAuthError(400, {
        code: 400,
        error_code: 'email_not_confirmed',
        msg: 'Email not confirmed',
      }).error,
      'email_not_confirmed',
    );
    assert.equal(
      mapSupabaseAuthError(400, {
        code: 400,
        error_code: 'invalid_credentials',
        msg: 'Invalid login credentials',
      }).error,
      'invalid_credentials',
    );
    assert.equal(
      mapSupabaseAuthError(400, {
        error: 'invalid_grant',
        error_description: 'Invalid login credentials',
      }).error,
      'invalid_credentials',
    );
    assert.equal(
      mapSupabaseAuthError(422, {
        code: 422,
        error_code: 'weak_password',
        msg: 'Password should be at least 6 characters.',
      }).error,
      'weak_password',
    );
    assert.equal(
      mapSupabaseAuthError(400, {
        code: 400,
        error_code: 'email_address_invalid',
        msg: 'Email address is invalid',
      }).error,
      'email_invalid',
    );
    assert.equal(
      mapSupabaseAuthError(429, {
        code: 429,
        error_code: 'over_email_send_rate_limit',
        msg: 'email rate limit exceeded',
      }).error,
      'rate_limited',
    );
    assert.equal(mapSupabaseAuthError(500, { msg: 'unexpected_failure' }).error, 'unexpected');
    assert.notEqual(mapSupabaseAuthError(400, { msg: 'something else' }).error, 'rejected');
    assert.equal(mapSupabaseAuthError(503, {}).error, 'offline');
  });

  it('treats a user without an access token as confirmation required', () => {
    assert.equal(isPendingEmailConfirmation(200, { id: 'user-1', email: 'a@b.c' }), true);
    assert.equal(
      isPendingEmailConfirmation(200, { access_token: '', user: { id: 'user-1', email: 'a@b.c' } }),
      true,
    );
    assert.equal(
      isPendingEmailConfirmation(200, { access_token: 'eyJ.session', user: { id: 'user-1' } }),
      false,
    );
    assert.equal(isPendingEmailConfirmation(400, { id: 'user-1' }), false);
  });
});

describe('confirmation page', () => {
  it('does not treat a bare visit or success=true as a confirmed address', () => {
    assert.equal(interpretConfirmationLocation('', ''), 'idle');
    assert.equal(interpretConfirmationLocation('?status=confirmed', ''), 'idle');
    assert.equal(interpretConfirmationLocation('?success=true', ''), 'idle');
    assert.equal(interpretConfirmationLocation('?success=true&type=signup', ''), 'idle');
    assert.equal(interpretConfirmationLocation('', '#access_token=abc'), 'idle');
    assert.equal(
      interpretConfirmationLocation(
        '',
        '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
      ),
      'expired',
    );
    assert.equal(interpretConfirmationLocation('', '#error=server_error&error_code=unexpected_failure'), 'unavailable');
    assert.equal(interpretConfirmationLocation('?code=pkce-code', ''), 'unavailable');
    assert.equal(interpretConfirmationLocation('', '#access_token=abc&type=signup'), 'verify');
    assert.equal(interpretConfirmationLocation('', '#access_token=abc&type=recovery'), 'recover');
    assert.equal(interpretConfirmationLocation('', '#type=recovery'), 'other');
    assert.equal(interpretConfirmationLocation('', '#access_token=abc&type=magiclink'), 'other');
    assert.equal(interpretConfirmationLocation('', '#access_token=abc&type=invite'), 'other');
    assert.equal(userEmailIsConfirmed({ email_confirmed_at: '2026-10-01T00:00:00Z' }), true);
    assert.equal(userEmailIsConfirmed({ email_confirmed_at: null }), false);
    assert.equal(userEmailIsConfirmed({}), false);
    assert.equal(userEmailIsConfirmed({ user: { confirmed_at: '2026-10-01T00:00:00Z' } }), true);
  });

  it('keeps the success sentence out of the initial page and only links the two AnyChess clients', () => {
    const html = renderConfirmationPage({
      supabaseUrl: 'https://example.supabase.co',
      anonKey: 'public-anon',
    });
    const visible = html.match(/<p id="message">([^<]*)<\/p>/)?.[1];
    assert.equal(visible, CONFIRM_COPY.fr.checking);
    assert.notEqual(visible, CONFIRM_COPY.fr.confirmed);
    assert.match(html, /Adresse e-mail confirmée !/);
    assert.match(html, /Tu peux retourner dans AnyChess et te connecter à ton compte\./);
    assert.match(html, /Ce lien n’est plus valable/);
    assert.match(html, /Vérifie ta connexion dans AnyChess/);
    assert.match(html, /Email address confirmed!/);
    assert.match(html, /userEmailIsConfirmed/);
    assert.doesNotMatch(html, /service_role/);
    assert.doesNotMatch(html, /location\.href\s*=/);
    assert.doesNotMatch(html, /http-equiv="refresh"/);
    assert.match(html, /name="viewport" content="width=device-width, initial-scale=1"/);
    assert.match(html, /overflow-x:\s*hidden/);
    assert.match(html, /font-size:\s*18px/);
    assert.match(html, /min-height:\s*48px/);
    assert.match(html, /alt="AnyChess"/);
    assert.match(html, /src="\/brand\/anychess-logo\.png"/);
    assert.match(html, /intent:\/\/open#Intent;scheme=anychess;package=com\.anychess\.standalone;end/);
    assert.match(html, /method: 'PUT'/);
    assert.match(html, /action: 'verify'/);
    assert.match(html, /#0B1728/);
    assert.match(html, /#102040/);
    assert.match(html, /#F5A623/);
    assert.match(html, /<form id="recover" hidden="hidden">/);
    assert.match(html, /Enregistrer le mot de passe/);
    assert.match(html, /Mot de passe mis à jour/);
    assert.notEqual(CONFIRM_COPY.fr.recoverSaved, CONFIRM_COPY.fr.confirmed);
    const recoverBranch = html.indexOf("outcome === 'recover'");
    const verifyBranch = html.indexOf("outcome !== 'verify'");
    assert.ok(recoverBranch > 0 && verifyBranch > recoverBranch);
    assert.equal(pageClient('?client=dev'), 'dev');
    assert.equal(pageClient('?client=app'), 'app');
    assert.equal(pageClient('?client=https://evil.example'), 'app');
    assert.equal(pageClient('?scheme=exp%2Bmobile&url=https://evil.example'), 'app');
    assert.equal(pageLanguage('?lang=en', 'fr-FR'), 'en');
    assert.equal(pageLanguage('?lang=de', 'en-US'), 'en');
    assert.equal(pageLanguage('', 'fr-FR'), 'fr');
    assert.equal(pageLanguage('?lang=en#client=dev', ''), 'fr');
    const app = readFileSync(join(here, '../../../app.json'), 'utf8');
    assert.match(app, /"package": "com\.anychess\.app"/);
    assert.match(app, /"scheme": "mobile"/);
    assert.match(app, /"slug": "mobile"/);
    const androidApp = appOpenHref('app', 'Mozilla/5.0 (Linux; Android 14)');
    const androidDev = appOpenHref('dev', 'Mozilla/5.0 (Linux; Android 14)');
    assert.equal(androidApp, 'intent://open#Intent;scheme=anychess;package=com.anychess.standalone;end');
    assert.equal(androidDev, 'intent://open#Intent;scheme=exp+mobile;package=com.anychess.app;end');
    assert.equal(appOpenHref('app', 'iPhone'), 'anychess://');
    assert.equal(appOpenHref('dev', 'iPhone'), 'exp+mobile://');
    assert.doesNotMatch(androidApp, /com\.anychess\.app/);
    assert.match(androidDev, /package=com\.anychess\.app/);
    assert.equal(appOpenHref('javascript:alert(1)', 'Android'), androidApp);
    for (const href of [androidApp, androidDev, appOpenHref('app', ''), appOpenHref('dev', '')]) {
      assert.doesNotMatch(href, /access_token|refresh_token|http:|https:/);
    }
    assert.match(html, /function appOpenHref/);
    assert.doesNotMatch(PLAIN_FALLBACK, /Adresse e-mail confirmée/);
    assert.doesNotMatch(PLAIN_FALLBACK, /Mot de passe mis à jour/);
    assert.match(PLAIN_FALLBACK, /Nous ne pouvons pas confirmer le résultat/);
    assert.match(plainFallback('en'), /We can’t confirm the result from this page/);
    assert.equal(languageFromAccept('en-US,en;q=0.9'), 'en');
    assert.equal(languageFromAccept('fr-FR,fr;q=0.9,en;q=0.8'), 'fr');
    assert.equal(languageFromAccept(null), 'fr');
    const published = renderConfirmationPage({
      supabaseUrl: PUBLIC_SUPABASE_URL,
      anonKey: '',
      logoUrl: PUBLIC_LOGO_URL,
      verifyUrl: PUBLIC_VERIFY_URL,
    });
    const onDisk = readFileSync(join(repoRoot, 'site/auth/confirm.html'), 'utf8');
    assert.equal(onDisk, published);
    const svg = renderConfirmationSvg({
      supabaseUrl: PUBLIC_SUPABASE_URL,
      anonKey: '',
      logoUrl: PUBLIC_LOGO_URL,
      verifyUrl: PUBLIC_VERIFY_URL,
    });
    assert.equal(readFileSync(join(repoRoot, 'site/auth/confirm.svg'), 'utf8'), svg);
    assert.match(svg, /<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    assert.match(svg, /<!\[CDATA\[/);
    assert.match(onDisk, /src="https:\/\/cdn\.jsdelivr\.net\/gh\/FlorianAussedat\/AnyChess-V1-web@43cd85cd3f2d6e9944106864fecaa7de527fc7b0\/artifacts\/mobile\/server\/brand\/anychess-logo\.png"/);
    assert.match(onDisk, /functions\/v1\/auth-confirm/);
    assert.match(onDisk, /"anon":""/);
    assert.doesNotMatch(onDisk, /service_role|sb_secret_/);
    const devRedirect = confirmPageRedirect(
      'https://zqfxnzwtptepulmgpxhb.supabase.co/functions/v1/auth-confirm?client=dev&lang=en&access_token=secret',
    );
    assert.equal(
      devRedirect,
      'https://cdn.jsdelivr.net/gh/FlorianAussedat/AnyChess-V1-web@cursor%2Fauth-confirm-page-90c2/site/auth/confirm.html?client=dev&lang=en',
    );
    assert.equal(confirmPageRedirect('https://example.test/functions/v1/auth-confirm').includes('client=app'), true);
    assert.equal(confirmPageRedirect('https://example.test/functions/v1/auth-confirm?client=javascript').includes('client=app'), true);
    assert.equal(PUBLIC_CONFIRM_PAGE_URL.includes('cursor%2Fauth-confirm-page-90c2'), true);
    assert.doesNotMatch(devRedirect, /access_token/);
  });
});

describe('confirmation email template', () => {
  it('keeps the Supabase confirmation URL and the AnyChess button in both languages', () => {
    const html = readFileSync(join(repoRoot, 'supabase/templates/confirmation.html'), 'utf8');
    const subject = readFileSync(join(repoRoot, 'supabase/templates/confirmation.subject.txt'), 'utf8').trim();
    assert.match(subject, /Confirme ton adresse e-mail — AnyChess/);
    assert.match(subject, /Confirm your email address — AnyChess/);
    assert.match(subject, /\{\{ if eq \.Data\.language "en" \}\}/);
    assert.match(html, /Bienvenue sur AnyChess !/);
    assert.match(html, /Welcome to AnyChess!/);
    assert.match(html, /Confirmer mon adresse e-mail/);
    assert.match(html, /Confirm my email address/);
    assert.match(html, /Tu n’as pas créé de compte AnyChess \? Tu peux ignorer cet e-mail\./);
    assert.match(html, /alt="AnyChess"/);
    assert.match(html, />AnyChess</);
    assert.match(html, /\{\{ \.ConfirmationURL \}\}/);
    assert.doesNotMatch(html, /success=true/);
    assert.doesNotMatch(html, /\/auth\/confirm/);
    assert.match(html, /#0B1728/);
    assert.match(html, /#F5A623/);
    assert.match(html, /#102040/);
    assert.match(html, /prefers-color-scheme: dark/);
    const recovery = readFileSync(join(repoRoot, 'supabase/templates/recovery.html'), 'utf8');
    const change = readFileSync(join(repoRoot, 'supabase/templates/email_change.html'), 'utf8');
    const code = readFileSync(join(repoRoot, 'supabase/templates/reauthentication.html'), 'utf8');
    assert.match(recovery, /\{\{ \.ConfirmationURL \}\}/);
    assert.match(recovery, /Choisir un nouveau mot de passe/);
    assert.match(change, /\{\{ \.ConfirmationURL \}\}/);
    assert.match(change, /Confirmer la nouvelle adresse/);
    assert.match(code, /\{\{ \.Token \}\}/);
    assert.doesNotMatch(code, /\.ConfirmationURL/);
  });
});

describe('account flow without a session', () => {
  it('shows confirmation instead of a sync error and does not upload', async () => {
    resetConfirmationEmailCooldown();
    const storage = new MemoryKeyValueStorage();
    const auth = new MemoryCloudAuth();
    auth.confirmEmails = true;
    let remoteCalls = 0;
    const remote = {
      async listDocuments(): Promise<CloudDocument[]> {
        remoteCalls += 1;
        return [];
      },
      async upsertDocument(): Promise<void> {
        remoteCalls += 1;
      },
    };
    const engine = new CloudSyncEngine(storage, auth, remote);
    await storage.setItem(StorageKeys.repertoires.key, repertoire());

    const created = await engine.signUp('ada@example.com', 'secret1');
    assert.equal(created.ok, false);
    if (!created.ok) assert.equal(created.error, 'confirm_email');
    const state = engine.getState();
    assert.equal(state.status, 'signed_out');
    assert.equal(state.user, null);
    assert.equal(state.lastError, null);
    assert.equal(state.pendingConfirmationEmail, 'ada@example.com');
    assert.equal(state.pendingConfirmationReason, 'signup');
    assert.equal(remoteCalls, 0);
    assert.match((await storage.getItem(StorageKeys.repertoires.key)) ?? '', /keep/);

    const blocked = await engine.resendSignupConfirmation('ada@example.com');
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.equal(blocked.error, 'rate_limited');
    assert.equal(auth.resent.length, 0);

    resetConfirmationEmailCooldown();
    const sent = await engine.resendSignupConfirmation('ada@example.com');
    assert.equal(sent.ok, true);
    assert.deepEqual(auth.resent, ['ada@example.com']);
    assert.equal(engine.getState().status, 'signed_out');
    assert.equal(engine.getState().user, null);
    const again = await engine.resendSignupConfirmation('ada@example.com');
    assert.equal(again.ok, false);
    assert.equal(auth.resent.length, 1);
  });

  it('keeps a wrong password on the account, not on the backup status', async () => {
    const storage = new MemoryKeyValueStorage();
    const engine = new CloudSyncEngine(storage, new MemoryCloudAuth(), new MemoryCloudRemote());
    await storage.setItem(StorageKeys.repertoires.key, repertoire());
    const signed = await engine.signIn('missing@example.com', 'secret1');
    assert.equal(signed.ok, false);
    if (!signed.ok) assert.equal(signed.error, 'invalid_credentials');
    assert.equal(engine.getState().status, 'signed_out');
    assert.equal(engine.getState().user, null);
    assert.equal(engine.getState().lastError, null);
    assert.equal(engine.getState().pendingConfirmationEmail, null);
    assert.match((await storage.getItem(StorageKeys.repertoires.key)) ?? '', /keep/);
  });

  it('keeps the account signed in when the backup fails', async () => {
    const storage = new MemoryKeyValueStorage();
    const auth = new MemoryCloudAuth();
    const remote = {
      async listDocuments(): Promise<CloudDocument[]> {
        throw new Error('list 500');
      },
      async upsertDocument(): Promise<void> {
        throw new Error('list 500');
      },
    };
    const engine = new CloudSyncEngine(storage, auth, remote);
    const created = await engine.signUp('ada@example.com', 'secret1');
    assert.equal(created.ok, true);
    assert.equal(engine.getState().status, 'error');
    assert.equal(engine.getState().user?.email, 'ada@example.com');
    assert.equal(engine.getState().pendingConfirmationEmail, null);
  });

  it('asks to confirm again when sign-in is rejected for an unconfirmed address', async () => {
    const storage = new MemoryKeyValueStorage();
    const auth = new MemoryCloudAuth();
    const engine = new CloudSyncEngine(storage, auth as CloudAuth, new MemoryCloudRemote());
    auth.signIn = async () => ({ ok: false, error: 'email_not_confirmed' });
    const signed = await engine.signIn('ada@example.com', 'secret1');
    assert.equal(signed.ok, false);
    assert.equal(engine.getState().status, 'signed_out');
    assert.equal(engine.getState().pendingConfirmationReason, 'signin');
    assert.equal(engine.getState().user, null);
  });
});

describe('auth screen copy wiring', () => {
  it('separates account and backup, and does not use the generic refusal', () => {
    const ui = readFileSync(join(here, '../../../components/cloud/CloudAccountSection.tsx'), 'utf8');
    assert.match(ui, /cloud-account-status/);
    assert.match(ui, /cloud-backup-status/);
    assert.match(ui, /cloud-resend/);
    assert.match(ui, /cloud-back-to-signin/);
    assert.match(ui, /cloud\.confirmSent/);
    assert.doesNotMatch(ui, /cloud\.errorRejected/);
    const live = readFileSync(join(here, '../SupabaseCloud.ts'), 'utf8');
    assert.match(live, /redirect_to/);
    const recover = live.slice(live.indexOf('async recoverPassword'));
    assert.match(recover, /\/auth\/v1\/recover/);
    assert.match(recover, /redirect_to/);
    assert.match(recover, /authConfirmRedirectUrl\(/);
    const previousUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const previousAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    const previousPage = process.env.EXPO_PUBLIC_AUTH_CONFIRM_URL;
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'public-anon';
    delete process.env.EXPO_PUBLIC_AUTH_CONFIRM_URL;
    assert.equal(
      authConfirmRedirectUrl(),
      'https://example.supabase.co/functions/v1/auth-confirm',
    );
    process.env.EXPO_PUBLIC_AUTH_CONFIRM_URL = 'http://localhost:3000/auth/confirm';
    assert.equal(
      authConfirmRedirectUrl(),
      'https://example.supabase.co/functions/v1/auth-confirm',
    );
    const previousClient = process.env.EXPO_PUBLIC_APP_CLIENT;
    delete process.env.EXPO_PUBLIC_APP_CLIENT;
    process.env.EXPO_PUBLIC_AUTH_CONFIRM_URL = 'https://anychess.example/auth/confirm/?next=https://evil.example';
    assert.equal(authConfirmRedirectUrl(), 'https://anychess.example/auth/confirm?client=app&lang=fr');
    assert.equal(authConfirmRedirectUrl('en'), 'https://anychess.example/auth/confirm?client=app&lang=en');
    process.env.EXPO_PUBLIC_AUTH_CONFIRM_URL =
      'https://cdn.jsdelivr.net/gh/FlorianAussedat/AnyChess-V1-web@43cd85cd3f2d6e9944106864fecaa7de527fc7b0/site/auth/confirm.html';
    assert.equal(
      authConfirmRedirectUrl('en'),
      'https://cdn.jsdelivr.net/gh/FlorianAussedat/AnyChess-V1-web@43cd85cd3f2d6e9944106864fecaa7de527fc7b0/site/auth/confirm.html?client=app&lang=en',
    );
    process.env.EXPO_PUBLIC_AUTH_CONFIRM_URL =
      'https://cdn.jsdelivr.net/gh/FlorianAussedat/AnyChess-V1-web@43cd85cd3f2d6e9944106864fecaa7de527fc7b0/site/auth/confirm.svg';
    assert.equal(
      authConfirmRedirectUrl('fr'),
      'https://cdn.jsdelivr.net/gh/FlorianAussedat/AnyChess-V1-web@43cd85cd3f2d6e9944106864fecaa7de527fc7b0/site/auth/confirm.svg?client=app&lang=fr',
    );
    process.env.EXPO_PUBLIC_AUTH_CONFIRM_URL = PUBLIC_CONFIRM_PAGE_URL;
    assert.equal(
      authConfirmRedirectUrl('fr'),
      `${PUBLIC_CONFIRM_PAGE_URL}?client=app&lang=fr`,
    );
    process.env.EXPO_PUBLIC_APP_CLIENT = 'dev';
    process.env.EXPO_PUBLIC_AUTH_CONFIRM_URL = 'https://anychess.example/auth/confirm';
    assert.equal(authClientVariant(), 'dev');
    assert.equal(
      authConfirmRedirectUrl('fr'),
      'https://anychess.example/auth/confirm?client=dev&lang=fr',
    );
    process.env.EXPO_PUBLIC_APP_CLIENT = 'https://evil.example';
    assert.equal(authClientVariant(), 'app');
    assert.equal(authMailLanguage('en'), 'en');
    assert.equal(authMailLanguage('de'), 'fr');
    if (previousClient === undefined) delete process.env.EXPO_PUBLIC_APP_CLIENT;
    else process.env.EXPO_PUBLIC_APP_CLIENT = previousClient;
    if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    else process.env.EXPO_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousAnon === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = previousAnon;
    if (previousPage === undefined) delete process.env.EXPO_PUBLIC_AUTH_CONFIRM_URL;
    else process.env.EXPO_PUBLIC_AUTH_CONFIRM_URL = previousPage;
    assert.match(live, /type: 'signup'/);
    assert.match(live, /language/);
    assert.match(live, /data/);
    assert.match(live, /isPendingEmailConfirmation/);
    assert.doesNotMatch(live, /DEEPL_API_KEY|api-free\.deepl/);
  });
});

function startConfirmHost(env: NodeJS.ProcessEnv): Promise<{ port: number; stop: () => void }> {
  const child = spawn(process.execPath, ['--experimental-strip-types', join(repoRoot, 'artifacts/mobile/server/serve.js')], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`confirm host did not listen: ${buf}`));
    }, 8000);
    const onData = (chunk: Buffer) => {
      buf += chunk.toString();
      const match = buf.match(/port (\d+)/);
      if (!match || match[1] === '0') return;
      clearTimeout(timer);
      resolve({
        port: Number(match[1]),
        stop: () => child.kill(),
      });
    };
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`confirm host exited ${code}: ${buf}`));
    });
  });
}

describe('confirmation page on the existing web host', () => {
  it('serves text/html at /auth/confirm and stays plain text when unconfigured', async () => {
    const baseEnv = {
      ...process.env,
      PORT: '0',
      BASE_PATH: '/',
    };
    const ready = await startConfirmHost({
      ...baseEnv,
      EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'public-anon',
      ANYCHESS_SUPABASE_URL: '',
      ANYCHESS_SUPABASE_ANON_KEY: '',
    });
    try {
      const response = await fetch(`http://127.0.0.1:${ready.port}/auth/confirm`);
      const body = await response.text();
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type') ?? '', /text\/html/);
      assert.match(body, /Vérification du lien/);
      assert.match(body, /<form id="recover" hidden="hidden">/);
      assert.doesNotMatch(body, /service_role/);
      const logo = await fetch(`http://127.0.0.1:${ready.port}/brand/anychess-logo.png`);
      assert.equal(logo.status, 200);
      assert.match(logo.headers.get('content-type') ?? '', /image\/png/);
      assert.ok((await logo.arrayBuffer()).byteLength > 1000);
      const home = await fetch(`http://127.0.0.1:${ready.port}/`);
      assert.equal(home.status, 200);
      assert.match(home.headers.get('content-type') ?? '', /text\/html/);
    } finally {
      ready.stop();
    }

    const missing = await startConfirmHost({
      ...baseEnv,
      EXPO_PUBLIC_SUPABASE_URL: '',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: '',
      ANYCHESS_SUPABASE_URL: '',
      ANYCHESS_SUPABASE_ANON_KEY: '',
    });
    try {
      const response = await fetch(`http://127.0.0.1:${missing.port}/auth/confirm`);
      const body = await response.text();
      assert.equal(response.status, 503);
      assert.match(response.headers.get('content-type') ?? '', /text\/plain/);
      assert.match(body, /n’est pas configurée/);
      assert.doesNotMatch(body, /Adresse confirmée/);
    } finally {
      missing.stop();
    }
  });
});
