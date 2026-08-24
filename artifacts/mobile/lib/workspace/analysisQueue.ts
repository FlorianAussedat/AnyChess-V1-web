/**
 * Priority analysis queue for the workspace tree.
 * Pure and testable in Node: no React, no engine I/O inside the queue.
 */
import type { EngineEvaluation } from './types.ts';
import type { VariantTree } from './variantTree.ts';
import { currentNode } from './variantTree.ts';

export type AnalysisPriority = 1 | 2 | 3 | 4;

export type AnalysisParams = {
  movetimeMs: number;
  depth?: number;
};

export type AnalysisTask = {
  nodeId: string;
  fen: string;
  cacheKey: string;
  priority: AnalysisPriority;
  token: number;
  params: AnalysisParams;
};

export type AnalysisCacheEntry = {
  nodeId: string;
  fen: string;
  evaluation: EngineEvaluation;
  bestSan: string | null;
  depth: number;
};

export type PlannedAnalysis = {
  nodeId: string;
  fen: string;
  priority: AnalysisPriority;
};

export function analysisCacheKey(nodeId: string, fen: string): string {
  return `${nodeId}::${fen}`;
}

export function planAnalysisTasks(tree: VariantTree): PlannedAnalysis[] {
  const current = currentNode(tree);
  const seen = new Set<string>();
  const planned: PlannedAnalysis[] = [];

  const add = (nodeId: string | undefined, priority: AnalysisPriority): void => {
    if (!nodeId) return;
    const node = tree.nodesById[nodeId];
    if (!node || seen.has(nodeId)) return;
    seen.add(nodeId);
    planned.push({ nodeId, fen: node.fen, priority });
  };

  add(current.id, 1);

  add(current.parentId ?? undefined, 2);
  const preferred = tree.preferredChildByParentId[current.id];
  add(preferred, 2);
  for (const childId of current.childrenIds) {
    add(childId, 2);
  }
  const path = tree.activePathNodeIds;
  const index = path.indexOf(current.id);
  if (index >= 0) {
    add(path[index + 1], 2);
  }

  for (const nodeId of tree.mainlineNodeIds) {
    add(nodeId, 3);
  }

  for (const nodeId of Object.keys(tree.nodesById)) {
    add(nodeId, 4);
  }

  return planned;
}

export function createAnalysisQueue(options?: { maxCache?: number }) {
  const maxCache = options?.maxCache ?? 64;
  let tokenSeq = 0;
  let closed = false;
  let seq = 0;
  const pending: Array<AnalysisTask & { order: number }> = [];
  let active: AnalysisTask | null = null;
  const cache = new Map<string, AnalysisCacheEntry>();

  const taskKey = (nodeId: string, fen: string): string => `${nodeId}::${fen}`;

  const sortPending = (): void => {
    pending.sort((a, b) => a.priority - b.priority || a.order - b.order);
  };

  const touchCache = (key: string, entry: AnalysisCacheEntry): void => {
    cache.delete(key);
    cache.set(key, entry);
    while (cache.size > maxCache) {
      const oldest = cache.keys().next().value as string | undefined;
      if (!oldest) break;
      cache.delete(oldest);
    }
  };

  const enqueue = (
    input: {
      nodeId: string;
      fen: string;
      priority: AnalysisPriority;
      params?: AnalysisParams;
    },
  ): 'cached' | 'queued' | 'promoted' | 'ignored' => {
    if (closed) return 'ignored';
    const cacheKey = analysisCacheKey(input.nodeId, input.fen);
    const params: AnalysisParams = {
      movetimeMs: input.params?.movetimeMs ?? 800,
      depth: input.params?.depth,
    };
    const cached = cache.get(cacheKey);
    const incomingDepth = params.depth ?? 0;
    if (cached && incomingDepth <= cached.depth) {
      return 'cached';
    }

    if (active && active.nodeId === input.nodeId && active.fen === input.fen) {
      if (input.priority < active.priority) {
        active = { ...active, priority: input.priority, params };
      }
      return 'queued';
    }

    const existing = pending.find(
      (task) => task.nodeId === input.nodeId && task.fen === input.fen,
    );
    if (existing) {
      const promoted = input.priority < existing.priority;
      if (promoted) {
        existing.priority = input.priority;
        seq += 1;
        existing.order = -seq;
      }
      existing.params = {
        movetimeMs: Math.max(existing.params.movetimeMs, params.movetimeMs),
        depth: Math.max(existing.params.depth ?? 0, incomingDepth) || params.depth,
      };
      sortPending();
      return promoted ? 'promoted' : 'queued';
    }

    tokenSeq += 1;
    seq += 1;
    pending.push({
      nodeId: input.nodeId,
      fen: input.fen,
      cacheKey,
      priority: input.priority,
      token: tokenSeq,
      params,
      order: seq,
    });
    sortPending();
    return 'queued';
  };

  const promote = (nodeId: string, priority: AnalysisPriority): boolean => {
    if (closed) return false;
    const pendingTask = pending.find((task) => task.nodeId === nodeId);
    if (pendingTask) {
      if (priority < pendingTask.priority) pendingTask.priority = priority;
      seq += 1;
      pendingTask.order = -seq;
      sortPending();
      return true;
    }
    if (active?.nodeId === nodeId) {
      if (priority < active.priority) {
        active = { ...active, priority };
      }
      return true;
    }
    return false;
  };

  const cancel = (nodeId: string): boolean => {
    const before = pending.length;
    for (let i = pending.length - 1; i >= 0; i -= 1) {
      if (pending[i]!.nodeId === nodeId) pending.splice(i, 1);
    }
    if (active?.nodeId === nodeId) active = null;
    return pending.length !== before;
  };

  const cancelAll = (): void => {
    pending.length = 0;
    active = null;
  };

  const next = (): AnalysisTask | null => {
    if (closed || active) return null;
    while (pending.length > 0) {
      sortPending();
      const task = pending.shift()!;
      const cached = cache.get(task.cacheKey);
      const wantDepth = task.params.depth ?? 0;
      if (cached && wantDepth <= cached.depth) {
        continue;
      }
      active = {
        nodeId: task.nodeId,
        fen: task.fen,
        cacheKey: task.cacheKey,
        priority: task.priority,
        token: task.token,
        params: task.params,
      };
      return active;
    }
    return null;
  };

  const matchesActive = (token: number, nodeId: string, fen: string): boolean =>
    Boolean(
      active &&
        active.token === token &&
        active.nodeId === nodeId &&
        active.fen === fen,
    );

  const complete = (
    token: number,
    nodeId: string,
    fen: string,
    result: {
      evaluation: EngineEvaluation;
      bestSan: string | null;
      depth?: number;
    },
  ): boolean => {
    if (closed || !matchesActive(token, nodeId, fen)) return false;
    const depth = result.depth ?? result.evaluation.depth ?? active!.params.depth ?? 0;
    const key = active!.cacheKey;
    const existing = cache.get(key);
    if (!existing || depth >= existing.depth) {
      touchCache(key, {
        nodeId,
        fen,
        evaluation: result.evaluation,
        bestSan: result.bestSan,
        depth,
      });
    }
    active = null;
    return true;
  };

  const fail = (token: number, nodeId: string, error?: string): boolean => {
    void error;
    if (closed || !active || active.token !== token || active.nodeId !== nodeId) {
      return false;
    }
    active = null;
    return true;
  };

  const hasCachedResult = (cacheKey: string): boolean => cache.has(cacheKey);

  const getCachedResult = (cacheKey: string): AnalysisCacheEntry | null =>
    cache.get(cacheKey) ?? null;

  const close = (): void => {
    closed = true;
    pending.length = 0;
    active = null;
    cache.clear();
  };

  const getActive = (): AnalysisTask | null => active;
  const pendingCount = (): number => pending.length;
  const isClosed = (): boolean => closed;

  return {
    enqueue,
    promote,
    cancel,
    cancelAll,
    next,
    complete,
    fail,
    hasCachedResult,
    getCachedResult,
    close,
    getActive,
    pendingCount,
    isClosed,
    analysisCacheKey: (nodeId: string, fen: string) => analysisCacheKey(nodeId, fen),
  };
}

export type AnalysisQueue = ReturnType<typeof createAnalysisQueue>;
