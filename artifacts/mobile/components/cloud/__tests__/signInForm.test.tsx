/**
 * Sign-in form layout, password visibility, and a bounded wait.
 * The anon key is a fixture, not a project secret.
 */
import assert from 'node:assert/strict';
import { beforeEach, afterEach, describe, it } from 'node:test';
import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://zqfxnzwtptepulmgpxhb.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'public-anon-test';
delete process.env.ANYCHESS_SUPABASE_URL;
delete process.env.ANYCHESS_SUPABASE_ANON_KEY;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const here = dirname(fileURLToPath(import.meta.url));
const { create, act } = await import('react-test-renderer');
const { CloudSyncEngine } = await import('../../../lib/cloud/CloudSyncEngine.ts');
const { MemoryKeyValueStorage } = await import('../../../lib/storage/KeyValueStorage.ts');
const { MemoryCloudAuth, MemoryCloudRemote } = await import('../../../lib/cloud/MemoryCloud.ts');
const { getActiveCloudEngine, setCloudEngineForTests } =
  await import('../../../lib/cloud/cloudStore.ts');
beforeEach(async () => {
  const engine = new CloudSyncEngine(
    new MemoryKeyValueStorage(),
    new MemoryCloudAuth(),
    new MemoryCloudRemote(),
  );
  await engine.hydrate();
  setCloudEngineForTests(engine);
});
afterEach(() => setCloudEngineForTests(null));
const { navigationCalls } =
  await import('../../../lib/theoreticalEndgame/__tests__/uiShims/expoRouter.ts');
const { setAuthReturn } = await import('../../../lib/cloud/authReturn.ts');
const { getAppDialogRequest, dismissAppDialog, __resetAppDialogStoreForTests } =
  await import('../../../lib/ui/appDialogStore.ts');
const { CloudAccountSection } = await import('../CloudAccountSection.tsx');

function ids(node: { children?: unknown; props?: { testID?: string } }): string[] {
  const found: string[] = [];
  const walk = (current: unknown) => {
    if (!current || typeof current !== 'object') return;
    const row = current as { children?: unknown; props?: { testID?: string } };
    if (row.props?.testID) found.push(row.props.testID);
    const children = row.children;
    if (Array.isArray(children)) for (const child of children) walk(child);
  };
  walk(node);
  return found;
}

describe('sign-in form', () => {
  it('stacks sign-in, recovery, and account creation, and toggles the password without signing in', async () => {
    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(React.createElement(CloudAccountSection));
    });
    const signin = renderer.root.findByProps({ testID: 'cloud-signin' });
    const signup = renderer.root.findByProps({ testID: 'cloud-signup' });
    const recover = renderer.root.findByProps({ testID: 'cloud-recover' });
    assert.equal(signin.parent, signup.parent);
    assert.equal(recover.parent, signin.parent);
    const order = ids(signin.parent);
    assert.ok(order.indexOf('cloud-signin') < order.indexOf('cloud-recover'));
    assert.ok(order.indexOf('cloud-recover') < order.indexOf('cloud-signup'));
    const style = JSON.stringify(signin.props.style);
    assert.match(style, /100%/);
    const email = renderer.root.findByProps({ testID: 'cloud-email' });
    assert.equal(email.props.autoComplete, 'email');
    assert.equal(email.props.textContentType, 'emailAddress');
    assert.equal(email.props.importantForAutofill, 'yes');
    const password = renderer.root
      .findAllByProps({ testID: 'cloud-password' })
      .find((node) => node.props.secureTextEntry != null);
    assert.ok(password);
    assert.equal(password.props.secureTextEntry, true);
    assert.equal(password.props.autoComplete, 'password');
    assert.equal(password.props.importantForAutofill, 'yes');
    await act(async () => {
      email.props.onChangeText('ada@example.com');
      password.props.onChangeText('secret1');
      renderer.root.findByProps({ testID: 'cloud-password-toggle' }).props.onPress();
    });
    const shown = renderer.root
      .findAllByProps({ testID: 'cloud-password' })
      .find((node) => node.props.secureTextEntry != null);
    assert.equal(shown.props.secureTextEntry, false);
    assert.equal(shown.props.value, 'secret1');
    assert.equal(renderer.root.findAllByProps({ testID: 'cloud-signin-busy' }).length, 0);
    const remember = renderer.root.findByProps({ testID: 'cloud-remember-email' });
    assert.equal(remember.props.accessibilityState.checked, false);
    const source = readFileSync(join(here, '../CloudAccountSection.tsx'), 'utf8');
    assert.match(source, /SIGN_IN_TIMEOUT_MS = 20_000/);
    assert.match(source, /abandoned/);
    assert.match(source, /rememberEmailAfterSignIn/);
    renderer.unmount();
  });

  it('disables the button while signing in and shows an error without clearing the fields', async () => {
    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(React.createElement(CloudAccountSection));
    });
    await act(async () => {
      renderer.root.findByProps({ testID: 'cloud-email' }).props.onChangeText('ada@example.com');
      const field = renderer.root
        .findAllByProps({ testID: 'cloud-password' })
        .find((node) => node.props.onChangeText);
      field?.props.onChangeText('secret1');
    });
    await act(async () => {
      renderer.root.findByProps({ testID: 'cloud-signin' }).props.onPress();
      renderer.root.findByProps({ testID: 'cloud-signin' }).props.onPress();
      await new Promise((resolve) => setImmediate(resolve));
    });
    const error = renderer.root.findByProps({ testID: 'cloud-form-error' });
    assert.match(String(error.props.children), /./);
    assert.equal(renderer.root.findByProps({ testID: 'cloud-signin' }).props.disabled, false);
    const kept = renderer.root
      .findAllByProps({ testID: 'cloud-password' })
      .find((node) => node.props.value != null);
    assert.equal(kept?.props.value, 'secret1');
    const email = renderer.root.findByProps({ testID: 'cloud-email' });
    assert.equal(email.props.value, 'ada@example.com');
    renderer.unmount();
  });
  it('shows only the connected account and sync controls, with no stale login form', async () => {
    await getActiveCloudEngine().signUp('demo@example.com', 'secret1');
    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(React.createElement(CloudAccountSection));
    });
    assert.match(
      String(renderer.root.findByProps({ testID: 'cloud-account-status' }).props.children),
      /demo@example.com/,
    );
    assert.equal(renderer.root.findAllByProps({ testID: 'cloud-email' }).length, 0);
    assert.ok(renderer.root.findByProps({ testID: 'cloud-sync' }));
    await act(async () => {
      renderer.unmount();
    });
  });
  it('waits for session hydration before displaying guest credentials', async () => {
    setCloudEngineForTests(
      new CloudSyncEngine(
        new MemoryKeyValueStorage(),
        new MemoryCloudAuth(),
        new MemoryCloudRemote(),
      ),
    );
    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(React.createElement(CloudAccountSection));
    });
    assert.equal(renderer.root.findAllByProps({ testID: 'cloud-email' }).length, 0);
    await act(async () => {
      renderer.unmount();
    });
  });
  it('returns once to the internal origin after sign-in and keeps the password out of storage', async () => {
    const engine = getActiveCloudEngine();
    await engine.signUp('demo@example.com', 'secret1');
    await engine.signOut();
    navigationCalls.length = 0;
    setAuthReturn('/parametres');
    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(React.createElement(CloudAccountSection));
    });
    await act(async () => {
      renderer.root.findByProps({ testID: 'cloud-email' }).props.onChangeText('demo@example.com');
      renderer.root
        .findAllByProps({ testID: 'cloud-password' })
        .find((node) => node.props.onChangeText)!
        .props.onChangeText('secret1');
    });
    await act(async () => {
      renderer.root.findByProps({ testID: 'cloud-signin' }).props.onPress();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    assert.deepEqual(
      navigationCalls.filter((call) => call.method === 'replace'),
      [{ method: 'replace', href: '/parametres' }],
    );
    for (const key of await engine.storageHandle().getAllKeys!())
      assert.doesNotMatch((await engine.storageHandle().getItem(key)) ?? '', /secret1/);
    await act(async () => {
      renderer.unmount();
    });
  });
  it('allows cancelling deletion and Android back clears the reauthentication password', async () => {
    await getActiveCloudEngine().signUp('demo@example.com', 'secret1');
    __resetAppDialogStoreForTests();
    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(React.createElement(CloudAccountSection));
    });
    await act(async () => {
      renderer.root.findByProps({ testID: 'account-delete-open' }).props.onPress();
      await new Promise((resolve) => setImmediate(resolve));
    });
    const first = getAppDialogRequest()!;
    first.actions!.find((action) => action.testID === 'account-delete-cancel')!.onPress();
    dismissAppDialog();
    assert.ok(getActiveCloudEngine().getState().user);
    await act(async () => {
      renderer.root.findByProps({ testID: 'account-delete-open' }).props.onPress();
      await new Promise((resolve) => setImmediate(resolve));
    });
    await act(async () => {
      getAppDialogRequest()!
        .actions!.find((action) => action.testID === 'account-delete-confirm')!
        .onPress();
      dismissAppDialog();
    });
    await act(async () => {
      renderer.root
        .findAllByProps({ testID: 'account-delete-password' })
        .find((node) => node.props.onChangeText)!
        .props.onChangeText('never-store');
    });
    await act(async () => {
      renderer.root
        .findAll(
          (node) => node.props.visible === true && typeof node.props.onRequestClose === 'function',
        )[0]
        .props.onRequestClose();
    });
    assert.equal(
      renderer.root
        .findAllByProps({ testID: 'account-delete-password' })
        .find((node) => node.props.value !== undefined)!.props.value,
      '',
    );
    assert.ok(getActiveCloudEngine().getState().user);
    await act(async () => {
      renderer.unmount();
    });
  });
});

it('shows a local storage warning after a refused sign-out and keeps the connected account', async () => {
  const engine = getActiveCloudEngine();
  await engine.signUp('demo@example.com', 'secret1');
  const storage = engine.storageHandle(),
    originalSet = storage.setItem.bind(storage);
  storage.setItem = async (key, value) => {
    if (key.includes('.workspace.')) throw new Error('SQLITE_FULL PRIVATE');
    await originalSet(key, value);
  };
  let renderer!: ReturnType<typeof create>;
  await act(async () => {
    renderer = create(React.createElement(CloudAccountSection));
  });
  await act(async () => {
    renderer.root.findByProps({ testID: 'cloud-signout' }).props.onPress();
  });
  await act(async () => {
    getAppDialogRequest()!.onConfirm!();
    dismissAppDialog();
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  assert.equal(engine.getState().lastError, 'local_quota');
  assert.ok(engine.getState().user);
  const warning = renderer.root.findByProps({ testID: 'cloud-operation-error' });
  assert.match(JSON.stringify(warning.props.children), /stockage local/i);
  assert.doesNotMatch(JSON.stringify(warning.props.children), /PRIVATE|SQLITE_FULL/);
  assert.equal(renderer.root.findAllByProps({ testID: 'cloud-form-error' }).length, 0);
  storage.setItem = originalSet;
  await act(async () => renderer.unmount());
});

it('distinguishes the missing server revision column from local storage failure in the account UI', async () => {
  const { CloudOperationError } = await import('../../../lib/cloud/diagnostics.ts');
  const auth = new MemoryCloudAuth();
  auth.seed('demo@example.com', 'secret1', 'owner');
  const engine = new CloudSyncEngine(new MemoryKeyValueStorage(), auth, {
    async listDocuments() {
      throw new CloudOperationError(
        'schema_revision_missing',
        'remote.list',
        'remote',
        400,
        '42703',
      );
    },
    async upsertDocument() {
      assert.fail('must not upload to incompatible schema');
    },
  });
  await engine.signIn('demo@example.com', 'secret1');
  setCloudEngineForTests(engine);
  let renderer!: ReturnType<typeof create>;
  await act(async () => {
    renderer = create(React.createElement(CloudAccountSection));
  });
  const warning = renderer.root.findByProps({ testID: 'cloud-operation-error' });
  assert.match(JSON.stringify(warning.props.children), /colonne de révision/);
  assert.equal(renderer.root.findAllByProps({ testID: 'cloud-local-save-error' }).length, 0);
  await act(async () => {
    renderer.unmount();
    await engine.signOut();
  });
});
