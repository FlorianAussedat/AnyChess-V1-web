/**
 * AnyLyseur engine bootstrap / retry — no React.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { EngineAnalysis } from '@/lib/engines/analysis';
import { AnalysisController } from '../AnalysisController.ts';
import type { AnalyzePositionRequest, ChessEngine } from '../engine/ChessEngine.ts';
import {
  initAnalysisControllerSafely,
  replaceAnalysisController,
} from '../anyliseurEngineLifecycle.ts';

class ScriptedEngine implements ChessEngine {
  disposed = 0;
  initCalls = 0;
  initImpl: () => Promise<void>;

  constructor(initImpl: () => Promise<void> = async () => {}) {
    this.initImpl = initImpl;
  }

  getStatus() {
    return this.disposed ? ('unavailable' as const) : ('ready' as const);
  }

  async init() {
    this.initCalls += 1;
    await this.initImpl();
  }

  async analyzePosition(_req: AnalyzePositionRequest): Promise<EngineAnalysis> {
    return {
      bestMove: null,
      score: { type: 'cp', value: 0 },
      scoreCp: 0,
      mateIn: null,
      wdl: null,
      depth: 0,
      lines: [],
    };
  }

  async stop() {}

  dispose() {
    this.disposed += 1;
  }
}

function unavailableNativeInit(): Promise<void> {
  return Promise.reject(new Error('[ChessEngineService] Unavailable.'));
}

describe('initAnalysisControllerSafely', () => {
  it('never rejects when native engine init is unavailable', async () => {
    const engine = new ScriptedEngine(unavailableNativeInit);
    const controller = new AnalysisController({ engine });
    await initAnalysisControllerSafely(controller);
    const state = controller.getState();
    assert.equal(state.engineStatus, 'unavailable');
    assert.match(state.engineError ?? '', /Unavailable/);
  });

  it('keeps the real web init error on the controller instead of hiding it', async () => {
    const engine = new ScriptedEngine(async () => {
      throw new Error('Worker failed to boot');
    });
    const controller = new AnalysisController({ engine });
    await initAnalysisControllerSafely(controller);
    const state = controller.getState();
    assert.equal(state.engineStatus, 'unavailable');
    assert.equal(state.engineError, 'Worker failed to boot');
  });

  it('does not mark a successful init as unavailable', async () => {
    const engine = new ScriptedEngine(async () => {});
    const controller = new AnalysisController({ engine });
    await initAnalysisControllerSafely(controller);
    assert.equal(controller.getState().engineStatus, 'ready');
    assert.equal(controller.getState().engineError, null);
  });
});

describe('replaceAnalysisController', () => {
  it('disposes the previous controller before creating the next', async () => {
    const order: string[] = [];
    const previous = {
      async init() {},
      async dispose() {
        order.push('dispose-previous');
      },
    };
    const next = await replaceAnalysisController({
      previous,
      create: () => {
        order.push('create');
        return {
          async init() {
            order.push('init');
          },
          async dispose() {
            order.push('dispose-next');
          },
        };
      },
      isStale: () => false,
    });
    assert.ok(next);
    assert.deepEqual(order, ['dispose-previous', 'create', 'init']);
  });

  it('does not leave an orphan controller if unmounted during retry', async () => {
    let stale = false;
    const created: Array<{ disposed: number }> = [];
    const next = await replaceAnalysisController({
      previous: {
        async init() {},
        async dispose() {
          stale = true;
        },
      },
      create: () => {
        const ctrl = {
          disposed: 0,
          async init() {},
          async dispose() {
            ctrl.disposed += 1;
          },
        };
        created.push(ctrl);
        return ctrl;
      },
      isStale: () => stale,
    });
    assert.equal(next, null);
    assert.equal(created.length, 0);
  });

  it('disposes a controller created after unmount mid-init', async () => {
    let stale = false;
    const created: Array<{ disposed: number; inited: number }> = [];
    const next = await replaceAnalysisController({
      previous: null,
      create: () => {
        const ctrl = {
          disposed: 0,
          inited: 0,
          async init() {
            ctrl.inited += 1;
            stale = true;
          },
          async dispose() {
            ctrl.disposed += 1;
          },
        };
        created.push(ctrl);
        return ctrl;
      },
      isStale: () => stale,
    });
    assert.equal(next, null);
    assert.equal(created.length, 1);
    assert.equal(created[0]!.inited, 1);
    assert.equal(created[0]!.disposed, 1);
  });
});
