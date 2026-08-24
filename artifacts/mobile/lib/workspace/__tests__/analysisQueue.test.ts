import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analysisCacheKey,
  createAnalysisQueue,
  planAnalysisTasks,
} from '../analysisQueue.ts';
import {
  createTreeFromFen,
  goStart,
  playSan,
  STANDARD_START_FEN,
} from '../variantTree.ts';
import type { EngineEvaluation } from '../types.ts';

const evalCp = (value: number, depth: number): EngineEvaluation => ({
  type: 'cp',
  value,
  perspective: 'white',
  depth,
});

function enqueuePlan(
  queue: ReturnType<typeof createAnalysisQueue>,
  items: Array<{ nodeId: string; fen: string; priority: 1 | 2 | 3 | 4 }>,
): void {
  for (const item of items) {
    queue.enqueue(item);
  }
}

test('order: displayed node is served before neighbors, mainline, then variants', () => {
  const queue = createAnalysisQueue();
  queue.enqueue({ nodeId: 'var', fen: 'f4', priority: 4 });
  queue.enqueue({ nodeId: 'main', fen: 'f3', priority: 3 });
  queue.enqueue({ nodeId: 'near', fen: 'f2', priority: 2 });
  queue.enqueue({ nodeId: 'view', fen: 'f1', priority: 1 });
  const first = queue.next();
  assert.equal(first?.nodeId, 'view');
  assert.equal(
    queue.complete(first!.token, first!.nodeId, first!.fen, {
      evaluation: evalCp(10, 8),
      bestSan: 'e4',
      depth: 8,
    }),
    true,
  );
  const second = queue.next();
  assert.equal(second?.nodeId, 'near');
  queue.complete(second!.token, second!.nodeId, second!.fen, {
    evaluation: evalCp(11, 8),
    bestSan: 'd4',
    depth: 8,
  });
  const third = queue.next();
  assert.equal(third?.nodeId, 'main');
  queue.complete(third!.token, third!.nodeId, third!.fen, {
    evaluation: evalCp(12, 8),
    bestSan: 'c4',
    depth: 8,
  });
  assert.equal(queue.next()?.nodeId, 'var');
});

test('dedup: the same node+fen is not queued twice', () => {
  const queue = createAnalysisQueue();
  assert.equal(queue.enqueue({ nodeId: 'n1', fen: 'f', priority: 3 }), 'queued');
  assert.equal(queue.enqueue({ nodeId: 'n1', fen: 'f', priority: 3 }), 'queued');
  assert.equal(queue.pendingCount(), 1);
});

test('promote: an existing task can jump to the displayed priority', () => {
  const queue = createAnalysisQueue();
  queue.enqueue({ nodeId: 'later', fen: 'f', priority: 4 });
  queue.enqueue({ nodeId: 'other', fen: 'g', priority: 2 });
  assert.equal(queue.enqueue({ nodeId: 'later', fen: 'f', priority: 1 }), 'promoted');
  assert.equal(queue.next()?.nodeId, 'later');
});

test('cache hit: next() skips a node that already has a deep enough result', () => {
  const queue = createAnalysisQueue();
  queue.enqueue({ nodeId: 'n', fen: 'f', priority: 1, params: { movetimeMs: 200, depth: 8 } });
  const task = queue.next()!;
  queue.complete(task.token, task.nodeId, task.fen, {
    evaluation: evalCp(20, 12),
    bestSan: 'e4',
    depth: 12,
  });
  assert.equal(queue.hasCachedResult(analysisCacheKey('n', 'f')), true);
  assert.equal(
    queue.enqueue({ nodeId: 'n', fen: 'f', priority: 1, params: { movetimeMs: 200, depth: 8 } }),
    'cached',
  );
  assert.equal(queue.next(), null);
});

test('rapid navigation: the newly displayed node is served first', () => {
  const queue = createAnalysisQueue();
  queue.enqueue({ nodeId: 'a', fen: 'fa', priority: 1 });
  queue.enqueue({ nodeId: 'b', fen: 'fb', priority: 2 });
  queue.enqueue({ nodeId: 'c', fen: 'fc', priority: 3 });
  queue.promote('c', 1);
  assert.equal(queue.next()?.nodeId, 'c');
});

test('cancel removes a pending node without touching others', () => {
  const queue = createAnalysisQueue();
  queue.enqueue({ nodeId: 'a', fen: 'fa', priority: 1 });
  queue.enqueue({ nodeId: 'b', fen: 'fb', priority: 2 });
  queue.cancel('a');
  assert.equal(queue.next()?.nodeId, 'b');
});

test('close drops pending work and rejects later replies', () => {
  const queue = createAnalysisQueue();
  queue.enqueue({ nodeId: 'a', fen: 'fa', priority: 1 });
  const task = queue.next()!;
  queue.close();
  assert.equal(queue.next(), null);
  assert.equal(
    queue.complete(task.token, task.nodeId, task.fen, {
      evaluation: evalCp(1, 8),
      bestSan: null,
      depth: 8,
    }),
    false,
  );
  assert.equal(queue.enqueue({ nodeId: 'b', fen: 'fb', priority: 1 }), 'ignored');
  assert.equal(queue.isClosed(), true);
});

test('stale reply: token/node/fen mismatch is ignored', () => {
  const queue = createAnalysisQueue();
  queue.enqueue({ nodeId: 'a', fen: 'fa', priority: 1 });
  const task = queue.next()!;
  assert.equal(
    queue.complete(task.token + 99, task.nodeId, task.fen, {
      evaluation: evalCp(1, 8),
      bestSan: null,
    }),
    false,
  );
  assert.equal(
    queue.complete(task.token, 'other', task.fen, {
      evaluation: evalCp(1, 8),
      bestSan: null,
    }),
    false,
  );
  assert.equal(
    queue.complete(task.token, task.nodeId, 'other-fen', {
      evaluation: evalCp(1, 8),
      bestSan: null,
    }),
    false,
  );
  assert.equal(
    queue.complete(task.token, task.nodeId, task.fen, {
      evaluation: evalCp(5, 10),
      bestSan: 'e4',
      depth: 10,
    }),
    true,
  );
});

test('two nodes at the same ply keep separate cache entries', () => {
  const queue = createAnalysisQueue();
  queue.enqueue({ nodeId: 'e4', fen: 'fen-e4', priority: 1 });
  queue.enqueue({ nodeId: 'd4', fen: 'fen-d4', priority: 1 });
  const first = queue.next()!;
  queue.complete(first.token, first.nodeId, first.fen, {
    evaluation: evalCp(40, 12),
    bestSan: 'e4',
    depth: 12,
  });
  const second = queue.next()!;
  queue.complete(second.token, second.nodeId, second.fen, {
    evaluation: evalCp(25, 12),
    bestSan: 'd4',
    depth: 12,
  });
  assert.equal(queue.getCachedResult(analysisCacheKey('e4', 'fen-e4'))?.evaluation.value, 40);
  assert.equal(queue.getCachedResult(analysisCacheKey('d4', 'fen-d4'))?.evaluation.value, 25);
});

test('deep analysis is not overwritten by a shallower result', () => {
  const queue = createAnalysisQueue();
  queue.enqueue({ nodeId: 'n', fen: 'f', priority: 1, params: { movetimeMs: 2000, depth: 20 } });
  const deep = queue.next()!;
  queue.complete(deep.token, deep.nodeId, deep.fen, {
    evaluation: evalCp(30, 20),
    bestSan: 'e4',
    depth: 20,
  });
  queue.enqueue({ nodeId: 'n', fen: 'f', priority: 1, params: { movetimeMs: 200, depth: 8 } });
  assert.equal(queue.getCachedResult(analysisCacheKey('n', 'f'))?.depth, 20);
  assert.equal(queue.next(), null);
});

test('only one calculation is active at a time', () => {
  const queue = createAnalysisQueue();
  queue.enqueue({ nodeId: 'a', fen: 'fa', priority: 1 });
  queue.enqueue({ nodeId: 'b', fen: 'fb', priority: 1 });
  const first = queue.next();
  const second = queue.next();
  assert.ok(first);
  assert.equal(second, null);
  queue.fail(first!.token, first!.nodeId);
  assert.equal(queue.next()?.nodeId, 'b');
});

test('planAnalysisTasks ranks the displayed node first', () => {
  let tree = createTreeFromFen(STANDARD_START_FEN);
  tree = playSan(tree, 'e4')!;
  tree = goStart(tree);
  tree = playSan(tree, 'd4')!;
  const plan = planAnalysisTasks(tree);
  assert.equal(plan[0]?.nodeId, tree.currentNodeId);
  assert.equal(plan[0]?.priority, 1);
  const ids = plan.map((item) => item.nodeId);
  assert.equal(new Set(ids).size, ids.length);
});
