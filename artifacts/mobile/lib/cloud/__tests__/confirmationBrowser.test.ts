import assert from 'node:assert/strict';
import { it } from 'node:test';
import { runInNewContext } from 'node:vm';
import { readFileSync } from 'node:fs';
import { renderConfirmationPage } from '../../../../../supabase/functions/auth-confirm/page.ts';

function browser(query: string, fragment: string, fetchImpl: typeof fetch, language = 'fr') {
  const html = renderConfirmationPage({
    supabaseUrl: 'https://example.supabase.co',
    anonKey: 'public-fixture',
  });
  const code = html.match(/<script>([\s\S]*?)<\/script>/)![1];
  const nodes = new Map<string, any>();
  for (const id of [
    'title',
    'message',
    'open',
    'alt',
    'recover',
    'password',
    'password2',
    'recover-error',
    'recover-submit',
    'label-password',
    'label-password2',
    'password-toggle',
    'password2-toggle',
  ])
    nodes.set(id, {
      textContent: '',
      value: '',
      hidden: id === 'recover',
      disabled: false,
      type: 'password',
      listeners: {} as Record<string, Function>,
      setAttribute(name: string, value: string) {
        this[name] = value;
      },
      addEventListener(name: string, handler: Function) {
        this.listeners[name] = handler;
      },
      focus() {},
      setSelectionRange() {},
    });
  const location = { pathname: '/auth/confirm', search: query, hash: fragment };
  const windowEvents: Record<string, Function> = {};
  const replaced: string[] = [];
  runInNewContext(code, {
    document: {
      getElementById: (id: string) => nodes.get(id),
      documentElement: { lang: language },
    },
    location,
    navigator: { language, userAgent: 'Android' },
    URLSearchParams,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: fetchImpl,
    history: {
      replaceState(_a: unknown, _b: unknown, next: string) {
        replaced.push(next);
        const url = new URL(next, 'https://example.test');
        location.search = url.search;
        location.hash = url.hash;
      },
    },
    window: {
      addEventListener: (name: string, handler: Function) => {
        windowEvents[name] = handler;
      },
    },
  });
  return {
    nodes,
    location,
    replaced,
    windowEvents,
    submit: () => nodes.get('recover').listeners.submit({ preventDefault() {} }),
  };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));
it('cannot confirm from URL success flags and strips all tokens before any interaction', async () => {
  let calls = 0;
  const page = browser('?client=dev&success=true&confirmed=true', '', async () => {
    calls++;
    return Response.json({});
  });
  await flush();
  assert.equal(calls, 0);
  assert.match(page.nodes.get('title').textContent, /n’a pas confirmé/);
  assert.equal(page.location.search, '?client=dev');
});
it('confirms only after a successful authenticated server response and sends no token in navigation', async () => {
  let calls = 0;
  const page = browser(
    '?client=dev&lang=en',
    '#access_token=fixture-secret&type=signup',
    async (url, init) => {
      calls++;
      assert.equal(String(url), 'https://example.supabase.co/auth/v1/user');
      assert.equal(
        (init!.headers as Record<string, string>).Authorization,
        'Bearer fixture-secret',
      );
      return Response.json({ email_confirmed_at: '2026-01-01' });
    },
    'en',
  );
  assert.equal(page.location.hash, '');
  assert.doesNotMatch(page.location.search, /fixture-secret/);
  await flush();
  assert.equal(calls, 1);
  assert.equal(page.nodes.get('title').textContent, 'Email address confirmed!');
  assert.match(page.nodes.get('open').href, /com.anychess.dev/);
  assert.doesNotMatch(page.nodes.get('open').href, /fixture-secret/);
});
it('rejects an expired token and never accepts a success body on failed HTTP', async () => {
  for (const status of [401, 500]) {
    const page = browser('?client=app', '#access_token=old&type=signup', async () =>
      Response.json({ email_confirmed_at: '2026-01-01' }, { status }),
    );
    await flush();
    assert.doesNotMatch(page.nodes.get('title').textContent, /confirmée !/);
    assert.match(page.nodes.get('open').href, /com.anychess.app/);
    assert.equal(page.location.search, '?client=app');
  }
});
it('validates password confirmation locally, submits once, and clears secrets only after acknowledged recovery', async () => {
  let calls = 0,
    release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  const page = browser(
    '?client=dev&lang=en',
    '#access_token=recovery-fixture&type=recovery',
    async (_url, init) => {
      calls++;
      assert.equal(init?.method, 'PUT');
      assert.equal(JSON.parse(String(init?.body)).password, 'new-secret');
      await hold;
      return Response.json({ id: 'demo' });
    },
    'en',
  );
  assert.equal(page.nodes.get('recover').hidden, false);
  page.nodes.get('password').value = 'short';
  page.nodes.get('password2').value = 'short';
  page.submit();
  assert.equal(calls, 0);
  assert.match(page.nodes.get('recover-error').textContent, /6/);
  page.nodes.get('password').value = 'new-secret';
  page.nodes.get('password2').value = 'mismatch';
  page.submit();
  assert.equal(calls, 0);
  page.nodes.get('password2').value = 'new-secret';
  page.submit();
  page.submit();
  assert.equal(calls, 1);
  assert.equal(page.nodes.get('recover-submit').disabled, true);
  assert.notEqual(page.nodes.get('title').textContent, 'Password updated');
  release();
  await flush();
  assert.equal(page.nodes.get('title').textContent, 'Password updated');
  assert.equal(page.nodes.get('password').value, '');
  assert.equal(page.nodes.get('password2').value, '');
  assert.equal(page.nodes.get('recover').hidden, true);
});
it('allows retry after a recovery network error without claiming that the password changed', async () => {
  const page = browser('?client=app', '#access_token=recovery-fixture&type=recovery', async () => {
    throw Error('offline');
  });
  page.nodes.get('password').value = 'new-secret';
  page.nodes.get('password2').value = 'new-secret';
  page.submit();
  await flush();
  assert.equal(page.nodes.get('recover').hidden, false);
  assert.equal(page.nodes.get('recover-submit').disabled, false);
  assert.match(page.nodes.get('recover-error').textContent, /Réessaie/);
  assert.doesNotMatch(page.nodes.get('title').textContent, /mis à jour/);
});
it('keeps expired recovery failures separate from a successful request for email', async () => {
  const page = browser(
    '?lang=en',
    '#access_token=recovery-fixture&type=recovery',
    async () => Response.json({ message: 'JWT expired' }, { status: 401 }),
    'en',
  );
  page.nodes.get('password').value = 'new-secret';
  page.nodes.get('password2').value = 'new-secret';
  page.submit();
  await flush();
  assert.equal(page.nodes.get('title').textContent, 'This link is no longer valid');
  assert.equal(page.nodes.get('recover').hidden, true);
});
it('clears password fields on pagehide and masks them again', () => {
  const page = browser('?client=dev', '#access_token=recovery-fixture&type=recovery', async () =>
    Response.json({}),
  );
  page.nodes.get('password').value = 'secret';
  page.nodes.get('password2').value = 'secret';
  page.windowEvents.pagehide();
  assert.equal(page.nodes.get('password').value, '');
  assert.equal(page.nodes.get('password').type, 'password');
});
it('keeps the published Netlify artifact in exact agreement with the tested renderer', () => {
  const html = readFileSync(
    new URL('../../../../../site/auth/confirm.html', import.meta.url),
    'utf8',
  );
  assert.match(html, /if \(submit.disabled\) return/);
  assert.match(html, /stripTokens\(\);/);
  assert.match(html, /requestWithTimeout/);
  assert.doesNotMatch(html, /localStorage|sessionStorage|console\.log/);
});
