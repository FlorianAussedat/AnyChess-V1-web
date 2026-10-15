/**
 * The Déconnexion control receives the press, confirms, then returns to the sign-in form.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import React from 'react';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { StorageKeys } from '../../storage/StorageKeys.ts';
import { CloudSyncEngine } from '../CloudSyncEngine.ts';
import { MemoryCloudAuth, MemoryCloudRemote } from '../MemoryCloud.ts';
import { setCloudEngineForTests } from '../cloudStore.ts';
import { AppDialogHost } from '@/components/ui/AppDialogHost';
import { __resetAppDialogStoreForTests } from '@/lib/ui/appDialogStore';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

type Tree = {
  props?: { testID?: string; onPress?: () => void; disabled?: boolean };
  children?: Array<Tree | string> | null;
};

function walk(node: Tree | string | Array<Tree | string> | null | undefined, visit: (node: Tree) => void): void {
  if (node == null || typeof node === 'string') return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  visit(node);
  const children = node.children;
  if (typeof children === 'string') return;
  if (Array.isArray(children)) for (const child of children) walk(child as Tree, visit);
}

function textsOf(node: Tree | Tree[] | null): string[] {
  const out: string[] = [];
  walk(node, (item) => {
    const children = item.children as Array<Tree | string> | string | null | undefined;
    if (typeof children === 'string') out.push(children);
    else if (Array.isArray(children)) {
      for (const child of children) if (typeof child === 'string') out.push(child);
    }
  });
  return out;
}

function findByTestId(node: Tree | Tree[] | null, testID: string): Tree | null {
  let found: Tree | null = null;
  walk(node, (item) => {
    if (item.props?.testID === testID) found = item;
  });
  return found;
}

const { create, act } = await import('react-test-renderer');
const { CloudAccountSection } = await import('../../../components/cloud/CloudAccountSection.tsx');

describe('Déconnexion button', () => {
  beforeEach(() => {
    __resetAppDialogStoreForTests();
    setCloudEngineForTests(null);
  });

  async function signedInEngine() {
    const storage = new MemoryKeyValueStorage();
    const engine = new CloudSyncEngine(storage, new MemoryCloudAuth(), new MemoryCloudRemote());
    await storage.setItem(
      StorageKeys.repertoires.key,
      JSON.stringify({ version: 2, folders: [], files: [{ id: 'local-pgn', pgnText: '1. e4 *' }] }),
    );
    const created = await engine.signUp('ada@example.com', 'secret1');
    assert.equal(created.ok, true);
    setCloudEngineForTests(engine);
    return engine;
  }

  async function renderAccount() {
    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(
        React.createElement(
          React.Fragment,
          null,
          React.createElement(CloudAccountSection),
          React.createElement(AppDialogHost),
        ),
      );
    });
    return renderer;
  }

  it('opens a confirmation, cancel keeps the session, confirm shows the sign-in form', async () => {
    const engine = await signedInEngine();
    const renderer = await renderAccount();
    const tree = () => renderer.toJSON() as Tree;
    assert.ok(findByTestId(tree(), 'cloud-signout'));
    assert.equal(findByTestId(tree(), 'cloud-signout')?.props?.disabled, undefined);
    assert.equal(findByTestId(tree(), 'cloud-email'), null);
    assert.equal(textsOf(tree()).includes('Déconnexion'), true);

    await act(async () => {
      findByTestId(tree(), 'cloud-signout')?.props?.onPress?.();
    });
    assert.equal(textsOf(tree()).includes('Se déconnecter ?'), true);
    assert.ok(textsOf(tree()).some((line) => line.includes('restent sur cet appareil')));
    assert.equal(engine.getState().user?.email, 'ada@example.com');

    await act(async () => {
      findByTestId(tree(), 'app-dialog-cancel')?.props?.onPress?.();
    });
    assert.equal(engine.getState().user?.email, 'ada@example.com');
    assert.ok(findByTestId(tree(), 'cloud-signout'));
    assert.equal(findByTestId(tree(), 'cloud-email'), null);

    await act(async () => {
      findByTestId(tree(), 'cloud-signout')?.props?.onPress?.();
    });
    await act(async () => {
      findByTestId(tree(), 'app-dialog-confirm')?.props?.onPress?.();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    assert.equal(engine.getState().user, null);
    assert.equal(engine.getState().sessionReady, true);
    assert.ok(findByTestId(tree(), 'cloud-email'));
    assert.ok(findByTestId(tree(), 'cloud-password'));
    assert.equal(findByTestId(tree(), 'cloud-signout'), null);
    assert.equal(findByTestId(tree(), 'cloud-form-error'), null);
    renderer.unmount();
  });

  it('shows the failure and leaves the button usable', async () => {
    const engine = await signedInEngine();
    let calls = 0;
    engine.signOut = async () => {
      calls += 1;
      return { ok: false, error: 'unexpected' };
    };
    const renderer = await renderAccount();
    const tree = () => renderer.toJSON() as Tree;

    await act(async () => {
      findByTestId(tree(), 'cloud-signout')?.props?.onPress?.();
    });
    await act(async () => {
      findByTestId(tree(), 'app-dialog-confirm')?.props?.onPress?.();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    assert.equal(calls, 1);
    assert.equal(engine.getState().user?.email, 'ada@example.com');
    assert.equal(engine.getState().sessionReady, true);
    const error = textsOf(findByTestId(tree(), 'cloud-form-error'));
    assert.deepEqual(error, ['La déconnexion n’a pas abouti. Réessaie.']);
    assert.equal(findByTestId(tree(), 'cloud-signout')?.props?.disabled ?? false, false);

    await act(async () => {
      findByTestId(tree(), 'cloud-signout')?.props?.onPress?.();
    });
    await act(async () => {
      findByTestId(tree(), 'app-dialog-confirm')?.props?.onPress?.();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    assert.equal(calls, 2);
    renderer.unmount();
  });
});
