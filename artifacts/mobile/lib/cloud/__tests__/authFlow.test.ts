import assert from 'node:assert/strict';
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
import { authConfirmRedirectUrl } from '../supabaseConfig.ts';
import { MemoryCloudAuth, MemoryCloudRemote } from '../MemoryCloud.ts';
import type { CloudAuth, CloudDocument } from '../types.ts';
import { renderConfirmationPage } from '../../../../../supabase/functions/auth-confirm/page.ts';
import {
  CONFIRM_COPY,
  PLAIN_FALLBACK,
  interpretConfirmationLocation,
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
  it('does not treat a bare visit as a confirmed address', () => {
    assert.equal(interpretConfirmationLocation('', ''), 'idle');
    assert.equal(interpretConfirmationLocation('?status=confirmed', ''), 'idle');
    assert.equal(interpretConfirmationLocation('', '#access_token=abc'), 'idle');
    assert.equal(
      interpretConfirmationLocation(
        '',
        '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
      ),
      'expired',
    );
    assert.equal(interpretConfirmationLocation('', '#access_token=abc&type=signup'), 'verify');
    assert.equal(interpretConfirmationLocation('', '#access_token=abc&type=recovery'), 'other');
    assert.equal(userEmailIsConfirmed({ email_confirmed_at: '2026-10-01T00:00:00Z' }), true);
    assert.equal(userEmailIsConfirmed({ email_confirmed_at: null }), false);
    assert.equal(userEmailIsConfirmed({}), false);
    assert.equal(userEmailIsConfirmed({ user: { confirmed_at: '2026-10-01T00:00:00Z' } }), true);
  });

  it('keeps the success sentence out of the initial page and offers no Android deep link', () => {
    const html = renderConfirmationPage({
      supabaseUrl: 'https://example.supabase.co',
      anonKey: 'public-anon',
    });
    const visible = html.match(/<p id="message">([^<]*)<\/p>/)?.[1];
    assert.equal(visible, CONFIRM_COPY.checking);
    assert.notEqual(visible, CONFIRM_COPY.confirmed);
    assert.match(html, /Adresse confirmée ! Tu peux maintenant te connecter à AnyChess\./);
    assert.match(html, /userEmailIsConfirmed/);
    assert.doesNotMatch(html, /mobile:\/\//);
    assert.doesNotMatch(html, /Ouvrir AnyChess/);
    assert.doesNotMatch(html, /intent:\/\//);
    assert.doesNotMatch(PLAIN_FALLBACK, /Adresse confirmée !/);
    assert.match(PLAIN_FALLBACK, /n’a pas confirmé/);
    assert.match(PLAIN_FALLBACK, /expiré ou n’est plus valable/);
  });
});

describe('confirmation email template', () => {
  it('keeps the Supabase confirmation URL and the AnyChess button', () => {
    const html = readFileSync(join(repoRoot, 'supabase/templates/confirmation.html'), 'utf8');
    const subject = readFileSync(join(repoRoot, 'supabase/templates/confirmation.subject.txt'), 'utf8').trim();
    assert.equal(subject, 'Confirme ton adresse e-mail AnyChess');
    assert.match(html, /Confirmer mon adresse e-mail/);
    assert.match(html, /\{\{ \.ConfirmationURL \}\}/);
    assert.match(html, /#0B1728/);
    assert.match(html, /#F5A623/);
    assert.match(html, /#102040/);
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
    const previousUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const previousAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'public-anon';
    assert.equal(
      authConfirmRedirectUrl(),
      'https://example.supabase.co/functions/v1/auth-confirm',
    );
    if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    else process.env.EXPO_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousAnon === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = previousAnon;
    assert.match(live, /type: 'signup'/);
    assert.match(live, /isPendingEmailConfirmation/);
    assert.doesNotMatch(live, /DEEPL_API_KEY|api-free\.deepl/);
  });
});
