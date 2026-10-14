/**
 * Compact analysis panels and the curve hit target.
 * Node component test — not an Android device run.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import React from 'react';
import { mapEngineAnalysisToPosition } from '../mapEngineAnalysis.ts';
import { buildSelectedMoveReview } from '../reviewFocus.ts';
import { layoutEvalCurve } from '../evalCurveLayout.ts';
import type { EngineAnalysis } from '@/lib/engines/analysis';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

type Tree = {
  type?: string;
  props?: {
    testID?: string;
    onPress?: (event: { nativeEvent: { locationX: number } }) => void;
  };
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

function textsOf(node: Tree | null): string[] {
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

function findByTestId(node: Tree | null, testID: string): Tree | null {
  let found: Tree | null = null;
  walk(node, (item) => {
    if (item.props?.testID === testID) found = item;
  });
  return found;
}

const { create, act } = await import('react-test-renderer');
const { EngineLinesPanel } = await import('../../../components/analysis/EngineLinesPanel.tsx');
const { SelectedMovePanel } = await import('../../../components/analysis/SelectedMovePanel.tsx');
const { EvalCurve } = await import('../../../components/analysis/EvalCurve.tsx');

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

function engineRaw(mateIn: number | null, pv: string[], scoreCp = 30): EngineAnalysis {
  return {
    bestMove: pv[0]
      ? { from: pv[0].slice(0, 2), to: pv[0].slice(2, 4), uci: pv[0] }
      : null,
    score: mateIn != null ? { type: 'mate', value: mateIn } : { type: 'cp', value: scoreCp },
    scoreCp,
    mateIn,
    wdl: null,
    depth: 10,
    lines: pv.map((uci, index) => ({
      multipv: index + 1,
      scoreCp,
      mateIn: index === 0 ? mateIn : null,
      wdl: null,
      depth: 10,
      bestMove: uci.length >= 4 ? { from: uci.slice(0, 2), to: uci.slice(2, 4), uci } : null,
      pv: uci ? [uci] : [],
    })),
  };
}

describe('analysis panels', () => {
  it('shows the selected side and hides the details toggle', async () => {
    const before = mapEngineAnalysisToPosition(
      START,
      engineRaw(null, ['g1f3', 'e2e4', 'd2d4']),
      'fast',
    )!;
    const review = buildSelectedMoveReview({
      fenBefore: START,
      fenAfter: AFTER_E4,
      playedSan: 'e4',
      playedUci: 'e2e4',
      before,
      after: null,
    });
    let tree: ReturnType<typeof create> | null = null;
    await act(async () => {
      tree = create(
        React.createElement(SelectedMovePanel, {
          review,
          notation: 'en',
          linesFen: START,
          lines: before.lines,
          status: 'ready',
        }),
      );
    });
    const text = textsOf(tree!.toJSON() as Tree).join('\n');
    assert.match(text, /e4/);
    assert.match(text, /Nf3/);
    assert.match(text, /Possibilités à ce moment-là/);
    assert.match(text, /Du point de vue des Blancs/);
    assert.doesNotMatch(text, /Plus de détails|More details/);
    assert.equal(findByTestId(tree!.toJSON() as Tree, 'anyliseur-engine-lines-toggle'), null);
    const best = textsOf(findByTestId(tree!.toJSON() as Tree, 'anyliseur-played-vs-best-best')).join(' ');
    assert.match(best, /Nf3/);
    assert.doesNotMatch(text, /— M/);
    tree!.unmount();
  });

  it('does not render a dash mate when the variation is illegal', async () => {
    const mapped = mapEngineAnalysisToPosition(
      START,
      engineRaw(8, ['zzzz', 'a1a2']),
      'fast',
    )!;
    let tree: ReturnType<typeof create> | null = null;
    await act(async () => {
      tree = create(
        React.createElement(EngineLinesPanel, {
          fen: START,
          lines: mapped.lines,
          notation: 'en',
          title: 'Coups dans cette position',
          emptyLabel: 'Analyse incomplète',
        }),
      );
    });
    const text = textsOf(tree!.toJSON() as Tree).join('\n');
    assert.match(text, /Analyse incomplète/);
    assert.doesNotMatch(text, /M8|—/);
    assert.equal(findByTestId(tree!.toJSON() as Tree, 'anyliseur-engine-lines-toggle'), null);
    tree!.unmount();
  });

  it('selects the curve node under the touch', async () => {
    const points = [
      {
        nodeId: 'a',
        fen: START,
        moveNumber: 30,
        plyColor: 'w' as const,
        analysis: {
          nodeId: 'a',
          fen: START,
          evaluation: 20,
          mate: null,
          depth: 8,
          analyzedAt: 1,
          profileId: 'fast' as const,
          evalPerspective: 'white' as const,
        },
      },
      {
        nodeId: 'b',
        fen: AFTER_E4,
        moveNumber: 30,
        plyColor: 'b' as const,
        analysis: null,
      },
      {
        nodeId: 'c',
        fen: START,
        moveNumber: 31,
        plyColor: 'w' as const,
        analysis: {
          nodeId: 'c',
          fen: START,
          evaluation: null,
          mate: 6,
          depth: 8,
          analyzedAt: 1,
          profileId: 'fast' as const,
          evalPerspective: 'white' as const,
        },
      },
    ];
    const layout = layoutEvalCurve(
      points.map((point) => ({
        id: point.nodeId,
        fen: point.fen,
        moveNumber: point.moveNumber,
        plyColor: point.plyColor,
        evaluation: point.analysis?.evaluation ?? null,
        mate: point.analysis?.mate ?? null,
      })),
      360,
      96,
    );
    const selected: string[] = [];
    let tree: ReturnType<typeof create> | null = null;
    await act(async () => {
      tree = create(
        React.createElement(EvalCurve, {
          points,
          activeNodeId: 'c',
          layoutWidth: 360,
          onSelectNode: (id: string) => selected.push(id),
        }),
      );
    });
    const json = tree!.toJSON() as Tree;
    const text = textsOf(json).join('\n');
    assert.match(text, /M6/);
    assert.match(text, /Échelle plafonnée/);
    assert.match(text, /30/);
    const hit = findByTestId(json, 'anyliseur-eval-curve-hit');
    assert.ok(hit?.props?.onPress);
    await act(async () => {
      hit!.props!.onPress!({ nativeEvent: { locationX: layout.points[0]!.x } });
    });
    assert.deepEqual(selected, ['a']);
    tree!.unmount();
  });
});
