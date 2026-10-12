/**
 * Renders the theoretical play pieces: board hide, engine status, result.
 * This is a Node component test, not an Android device run.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import React from 'react';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

type Tree = {
  type?: string;
  props?: { testID?: string; accessibilityLabel?: string; onPress?: () => void };
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
  if (Array.isArray(children)) {
    for (const child of children) walk(child as Tree, visit);
  }
}

function textsOf(node: Tree | Tree[] | null): string[] {
  const out: string[] = [];
  walk(node, (item) => {
    const children = item.children as Array<Tree | string> | string | null | undefined;
    if (typeof children === 'string') out.push(children);
    else if (Array.isArray(children)) {
      for (const child of children) {
        if (typeof child === 'string') out.push(child);
      }
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
const { BoardVisibilityToggle } = await import('../../../components/BoardVisibilityToggle.tsx');
const { HiddenBoardPlaceholder } = await import('../../../components/HiddenBoardPlaceholder.tsx');
const { GameStatusCard } = await import('../../../components/game/GameStatusCard.tsx');
const { EndgameEngineStatusBanner } = await import('../../engines/runtime/EndgameEngineStatusBanner.tsx');
const { TheoreticalResultCard } = await import('../ui/TheoreticalResultCard.tsx');

function engineSnap(status: 'loading' | 'ready' | 'error' | 'unavailable') {
  return {
    status,
    lastError: status === 'error' ? 'boot failed' : null,
    workerPath: 'stockfish.js',
    platformOs: 'web',
    backend: 'wasm',
    bootStartedAt: 1,
    readyAt: status === 'ready' ? 2 : null,
  };
}

function BoardHarness() {
  const [visible, setVisible] = React.useState(true);
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(BoardVisibilityToggle, {
      visible,
      onToggle: () => setVisible((value) => !value),
    }),
    visible
      ? React.createElement('View', { testID: 'visible-board' }, 'échiquier')
      : React.createElement(HiddenBoardPlaceholder, {
          size: 320,
          onReveal: () => setVisible(true),
        }),
  );
}

describe('theoretical play components', () => {
  it('hides the board and shows it again', async () => {
    let renderer: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(React.createElement(BoardHarness));
    });
    const shown = renderer!.toJSON() as Tree;
    assert.ok(findByTestId(shown, 'visible-board'));
    assert.equal(findByTestId(shown, 'board-visibility-toggle')?.props?.accessibilityLabel, 'Masquer l’échiquier');
    assert.equal(textsOf(shown).includes('Échiquier masqué'), false);

    await act(async () => {
      renderer!.root.findByProps({ testID: 'board-visibility-toggle' }).props.onPress();
    });
    const hidden = renderer!.toJSON() as Tree;
    assert.equal(findByTestId(hidden, 'visible-board'), null);
    assert.ok(textsOf(hidden).includes('Échiquier masqué'));
    assert.ok(textsOf(hidden).includes('La partie continue normalement.'));
    assert.equal(
      renderer!.root.findByProps({ testID: 'board-visibility-toggle' }).props.accessibilityLabel,
      'Afficher l’échiquier',
    );

    await act(async () => {
      renderer!.root.findByProps({ testID: 'board-visibility-toggle' }).props.onPress();
    });
    const again = renderer!.toJSON() as Tree;
    assert.ok(findByTestId(again, 'visible-board'));
    assert.equal(textsOf(again).includes('Échiquier masqué'), false);
  });

  it('shows the thinking status and the engine banner', async () => {
    let thinking: ReturnType<typeof create>;
    let idle: ReturnType<typeof create>;
    let loading: ReturnType<typeof create>;
    let failed: ReturnType<typeof create>;
    await act(async () => {
      thinking = create(
        React.createElement(GameStatusCard, {
          status: 'À vous',
          heardText: '',
          isGameOver: false,
          isOpponentThinking: true,
          thinkingLabel: 'Stockfish réfléchit…',
          compact: true,
          testID: 'theoretical-coup-banner',
        }),
      );
      idle = create(
        React.createElement(GameStatusCard, {
          status: 'À vous',
          heardText: '',
          isGameOver: false,
          isOpponentThinking: false,
          compact: true,
          testID: 'theoretical-coup-banner',
        }),
      );
      loading = create(
        React.createElement(EndgameEngineStatusBanner, { snapshot: engineSnap('loading') }),
      );
      failed = create(
        React.createElement(EndgameEngineStatusBanner, {
          snapshot: engineSnap('error'),
          onRetry: () => undefined,
        }),
      );
    });
    assert.ok(textsOf(thinking!.toJSON() as Tree).includes('Stockfish réfléchit…'));
    assert.equal(textsOf(thinking!.toJSON() as Tree).includes('À vous'), false);
    assert.ok(textsOf(idle!.toJSON() as Tree).includes('À vous'));
    assert.equal(findByTestId(loading!.toJSON() as Tree, 'engine-status-loading') != null, true);
    assert.ok(textsOf(loading!.toJSON() as Tree).includes('Préparation de Stockfish…'));
    assert.equal(findByTestId(failed!.toJSON() as Tree, 'engine-status-error') != null, true);
    assert.ok(textsOf(failed!.toJSON() as Tree).join(' ').includes('Stockfish n’a pas pu démarrer'));
    assert.ok(findByTestId(failed!.toJSON() as Tree, 'engine-status-retry'));
    let ready: ReturnType<typeof create>;
    await act(async () => {
      ready = create(React.createElement(EndgameEngineStatusBanner, { snapshot: engineSnap('ready') }));
    });
    assert.equal(ready!.toJSON(), null);
  });

  it('renders the quality headline, comment and stats', async () => {
    let renderer: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(
        React.createElement(TheoreticalResultCard, {
          headline: '4/5 — Finale gagnée',
          comment: 'Bonne maîtrise, quelques détours (2 temps perdus sur les positions rencontrées).',
          stats: 'Coups joués : 3 · 12 s',
          official: 'Les Blancs gagnent.',
          tone: '#398a55',
          commentColor: '#DCE8F5',
          statsColor: '#5B7FA0',
        }),
      );
    });
    const tree = renderer!.toJSON() as Tree;
    assert.equal(findByTestId(tree, 'theoretical-result') != null, true);
    assert.ok(textsOf(tree).includes('4/5 — Finale gagnée'));
    assert.match(textsOf(tree).join('\n'), /2 temps perdus/);
    assert.ok(textsOf(tree).includes('Coups joués : 3 · 12 s'));
    assert.ok(textsOf(tree).includes('Les Blancs gagnent.'));

    let unevaluated: ReturnType<typeof create>;
    await act(async () => {
      unevaluated = create(
        React.createElement(TheoreticalResultCard, {
          headline: 'Qualité non évaluée — Défense réussie',
          comment: 'Qualité non évaluée.',
          stats: 'Coups joués : 4 · 8 s',
          official: 'Partie nulle.',
          tone: '#398a55',
          commentColor: '#DCE8F5',
          statsColor: '#5B7FA0',
        }),
      );
    });
    assert.ok(textsOf(unevaluated!.toJSON() as Tree).includes('Qualité non évaluée — Défense réussie'));
  });
});
