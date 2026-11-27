/**
 * The account section shows the sign-in form when the public Supabase pair is set.
 * The key here is a test fixture, not a project secret.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import React from 'react';

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://zqfxnzwtptepulmgpxhb.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'public-anon-test';
delete process.env.ANYCHESS_SUPABASE_URL;
delete process.env.ANYCHESS_SUPABASE_ANON_KEY;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

type Tree = {
  props?: { testID?: string };
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

function findByTestId(node: Tree | Tree[] | null, testID: string): Tree | null {
  let found: Tree | null = null;
  walk(node, (item) => {
    if (item.props?.testID === testID) found = item;
  });
  return found;
}

const { create, act } = await import('react-test-renderer');
const { CloudAccountSection } = await import('../../../components/cloud/CloudAccountSection.tsx');

const { cloudSyncEngine } = await import('../cloudStore.ts');
await cloudSyncEngine.hydrate();

describe('configured cloud account form', () => {
  it('shows the sign-in form and not the missing-config message', async () => {
    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(React.createElement(CloudAccountSection));
    });
    const tree = renderer.toJSON() as Tree;
    assert.ok(findByTestId(tree, 'cloud-email'));
    assert.ok(findByTestId(tree, 'cloud-password'));
    assert.ok(findByTestId(tree, 'cloud-signin'));
    assert.equal(findByTestId(tree, 'cloud-unconfigured'), null);
    const serialized = JSON.stringify(tree);
    assert.equal(serialized.includes('EXPO_PUBLIC_SUPABASE'), false);
    assert.equal(serialized.includes('service_role'), false);
    assert.equal(serialized.includes('DEEPL'), false);
    renderer.unmount();
  });
});
