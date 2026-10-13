/**
 * Without the public Supabase pair, the account tab stays a short message.
 * It does not ask for environment variables.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import React from 'react';

delete process.env.EXPO_PUBLIC_SUPABASE_URL;
delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
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

describe('missing cloud account config', () => {
  it('shows the short unavailable message and hides the form', async () => {
    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(React.createElement(CloudAccountSection));
    });
    const tree = renderer.toJSON() as Tree;
    assert.deepEqual(textsOf(findByTestId(tree, 'cloud-unconfigured')), [
      'Connexion au compte temporairement indisponible.',
    ]);
    assert.equal(findByTestId(tree, 'cloud-email'), null);
    assert.equal(findByTestId(tree, 'cloud-password'), null);
    const serialized = JSON.stringify(tree);
    assert.equal(serialized.includes('EXPO_PUBLIC_SUPABASE'), false);
    assert.equal(serialized.includes('DEEPL'), false);
    assert.equal(serialized.includes('service_role'), false);
    renderer.unmount();
  });
});
