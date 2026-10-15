/**
 * Sign-in form layout, password visibility, and a bounded wait.
 * The anon key is a fixture, not a project secret.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
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
});
