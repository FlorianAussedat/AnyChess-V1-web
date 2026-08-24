import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import {
  createFinishGameController,
  type FinishMoveInput,
} from '../finishGameController.ts';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

type ScriptedReply = FinishMoveInput | Error | 'timeout';

class SimulatedEngine {
  readonly calls: Array<{ fen: string; token: number }> = [];
  private readonly script = new Map<string, ScriptedReply[]>();

  on(fen: string, ...replies: ScriptedReply[]): void {
    this.script.set(fen, replies);
  }

  reply(
    controller: ReturnType<typeof createFinishGameController>,
    token: number,
    fen: string,
  ): void {
    this.calls.push({ fen, token });
    const queue = this.script.get(fen) ?? this.script.get('*');
    const next = queue?.shift();
    if (next == null) return;
    if (next instanceof Error) {
      controller.receiveEngineError(token, next.message);
      return;
    }
    if (next === 'timeout') {
      controller.receiveTimeout(token);
      return;
    }
    controller.receiveEngineMove(token, fen, next);
  }

  pump(controller: ReturnType<typeof createFinishGameController>): boolean {
    const request = controller.requestEngineMoveIfNeeded();
    if (!request.requested || request.token == null) return false;
    this.reply(controller, request.token, request.fen);
    return true;
  }
}

test('engine starts: one request then one legal reply', () => {
  const fen = '4k3/8/8/8/8/8/8/4K2R w - - 0 1';
  const engine = new SimulatedEngine();
  engine.on(fen, { from: 'h1', to: 'h8' });
  const controller = createFinishGameController({
    initialFen: fen,
    playerColor: 'black',
    engineColor: 'white',
  });
  assert.equal(controller.getState().phase, 'playing');
  assert.equal(engine.pump(controller), true);
  assert.equal(engine.calls.length, 1);
  assert.equal(controller.getState().historySans[0], 'Rh8+');
  assert.equal(controller.getState().engineThinking, false);
  assert.equal(engine.pump(controller), false);
});

test('player starts: no engine request until the player moves', () => {
  const engine = new SimulatedEngine();
  engine.on('*', { san: 'e5' });
  const controller = createFinishGameController({
    initialFen: START,
    playerColor: 'white',
    engineColor: 'black',
  });
  assert.equal(controller.requestEngineMoveIfNeeded().requested, false);
  assert.equal(controller.submitPlayerMove({ san: 'e4' }), true);
  assert.equal(engine.pump(controller), true);
  assert.equal(controller.getState().historySans.join(','), 'e4,e5');
});

test('re-render logic: a second request on the same state does not create a new token', () => {
  const fen = '4k3/8/8/8/8/8/8/4K2R w - - 0 1';
  const controller = createFinishGameController({
    initialFen: fen,
    playerColor: 'black',
    engineColor: 'white',
  });
  const first = controller.requestEngineMoveIfNeeded();
  const second = controller.requestEngineMoveIfNeeded();
  assert.equal(first.requested, true);
  assert.equal(second.requested, false);
  assert.equal(first.token, second.token);
  assert.equal(controller.getState().engineThinking, true);
});

test('double request: only one outstanding engine call', () => {
  const fen = '4k3/8/8/8/8/8/8/4K2R w - - 0 1';
  const engine = new SimulatedEngine();
  const controller = createFinishGameController({
    initialFen: fen,
    playerColor: 'black',
    engineColor: 'white',
  });
  engine.pump(controller);
  engine.pump(controller);
  engine.pump(controller);
  assert.equal(engine.calls.length, 1);
});

test('double reply: the second response with the same token is ignored', () => {
  const fen = '4k3/8/8/8/8/8/8/4K2R w - - 0 1';
  const controller = createFinishGameController({
    initialFen: fen,
    playerColor: 'black',
    engineColor: 'white',
  });
  const request = controller.requestEngineMoveIfNeeded();
  assert.ok(request.token);
  assert.equal(
    controller.receiveEngineMove(request.token!, request.fen, { from: 'h1', to: 'h8' }),
    true,
  );
  const fenAfter = controller.getState().fen;
  const historyLen = controller.getState().historySans.length;
  assert.equal(
    controller.receiveEngineMove(request.token!, request.fen, { from: 'e1', to: 'e2' }),
    false,
  );
  assert.equal(controller.getState().fen, fenAfter);
  assert.equal(controller.getState().historySans.length, historyLen);
});

test('stale response: a previous token is ignored after a new generation', () => {
  const controller = createFinishGameController({
    initialFen: START,
    playerColor: 'white',
    engineColor: 'black',
  });
  controller.submitPlayerMove({ san: 'e4' });
  const first = controller.requestEngineMoveIfNeeded();
  controller.submitPlayerMove({ san: 'd4' });
  assert.equal(controller.getState().historySans.join(','), 'e4');
  assert.equal(
    controller.receiveEngineMove(first.token!, first.fen, { san: 'e5' }),
    true,
  );
  const staleFen = first.fen;
  const staleToken = first.token!;
  controller.submitPlayerMove({ san: 'Nf3' });
  const second = controller.requestEngineMoveIfNeeded();
  assert.equal(
    controller.receiveEngineMove(staleToken, staleFen, { san: 'Nc6' }),
    false,
  );
  assert.equal(second.requested, true);
  assert.notEqual(second.token, staleToken);
});

test('old FEN: reply fen must match the outstanding request', () => {
  const fen = '4k3/8/8/8/8/8/8/4K2R w - - 0 1';
  const controller = createFinishGameController({
    initialFen: fen,
    playerColor: 'black',
    engineColor: 'white',
  });
  const request = controller.requestEngineMoveIfNeeded();
  assert.equal(
    controller.receiveEngineMove(request.token!, START, { from: 'h1', to: 'h8' }),
    false,
  );
  assert.equal(controller.getState().fen, fen);
  assert.equal(controller.getState().historySans.length, 0);
});

test('close during calculation: late reply is not applied', () => {
  const fen = '4k3/8/8/8/8/8/8/4K2R w - - 0 1';
  const controller = createFinishGameController({
    initialFen: fen,
    playerColor: 'black',
    engineColor: 'white',
  });
  const request = controller.requestEngineMoveIfNeeded();
  controller.close();
  assert.equal(controller.getState().phase, 'closed');
  assert.equal(
    controller.receiveEngineMove(request.token!, request.fen, { from: 'h1', to: 'h8' }),
    false,
  );
  assert.equal(controller.getState().historySans.length, 0);
  assert.equal(controller.getState().fen, fen);
});

test('engine error is recorded and does not move pieces', () => {
  const fen = '4k3/8/8/8/8/8/8/4K2R w - - 0 1';
  const engine = new SimulatedEngine();
  engine.on(fen, new Error('uci-crash'));
  const controller = createFinishGameController({
    initialFen: fen,
    playerColor: 'black',
    engineColor: 'white',
  });
  engine.pump(controller);
  assert.equal(controller.getState().phase, 'error');
  assert.equal(controller.getState().error, 'uci-crash');
  assert.equal(controller.getState().historySans.length, 0);
});

test('timeout fails the outstanding request only', () => {
  const fen = '4k3/8/8/8/8/8/8/4K2R w - - 0 1';
  const engine = new SimulatedEngine();
  engine.on(fen, 'timeout');
  const controller = createFinishGameController({
    initialFen: fen,
    playerColor: 'black',
    engineColor: 'white',
  });
  engine.pump(controller);
  assert.equal(controller.getState().phase, 'error');
  assert.equal(controller.getState().error, 'timeout');
  assert.equal(controller.getState().resultEmitted, false);
});

test('illegal engine move is rejected', () => {
  const fen = '4k3/8/8/8/8/8/8/4K2R w - - 0 1';
  const controller = createFinishGameController({
    initialFen: fen,
    playerColor: 'black',
    engineColor: 'white',
  });
  const request = controller.requestEngineMoveIfNeeded();
  assert.equal(
    controller.receiveEngineMove(request.token!, request.fen, { from: 'h1', to: 'a3' }),
    false,
  );
  assert.equal(controller.getState().phase, 'error');
  assert.equal(controller.getState().error, 'illegal-engine-move');
  assert.equal(controller.getState().fen, fen);
});

test('checkmate emits an official result once', () => {
  const fen = '6k1/5Q2/6K1/8/8/8/8/8 w - - 0 1';
  const controller = createFinishGameController({
    initialFen: fen,
    playerColor: 'white',
    engineColor: 'black',
  });
  assert.equal(controller.submitPlayerMove({ san: 'Qe8#' }), true);
  assert.equal(controller.getState().phase, 'game-over');
  assert.equal(controller.getState().result, '1-0');
  assert.equal(controller.getState().resultEmitted, true);
  assert.equal(controller.submitPlayerMove({ san: 'Kg7' }), false);
  assert.equal(controller.getState().result, '1-0');
  assert.equal(controller.getState().exerciseScoreRecorded, false);
});

test('stalemate is an official draw', () => {
  const fen = 'k7/8/1K6/8/8/8/1Q6/8 w - - 0 1';
  const controller = createFinishGameController({
    initialFen: fen,
    playerColor: 'white',
    engineColor: 'black',
  });
  assert.equal(controller.submitPlayerMove({ san: 'Ka6' }), true);
  assert.equal(controller.getState().result, '1/2-1/2');
  assert.equal(controller.getState().phase, 'game-over');
});

test('threefold repetition is detected from kept history', () => {
  const controller = createFinishGameController({
    initialFen: START,
    playerColor: 'white',
    engineColor: 'black',
  });
  const sequence = ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8'];
  for (const san of sequence) {
    const side = controller.getState().fen.split(' ')[1] === 'b' ? 'black' : 'white';
    if (side === 'white') {
      assert.equal(controller.submitPlayerMove({ san }), true);
    } else {
      const request = controller.requestEngineMoveIfNeeded();
      assert.equal(controller.receiveEngineMove(request.token!, request.fen, { san }), true);
    }
  }
  assert.equal(controller.getState().result, '1/2-1/2');
  assert.equal(controller.getState().phase, 'game-over');
});

test('fifty-move rule uses the kept half-move clock', () => {
  const fen = '4k3/8/8/8/8/8/7r/4K2R w - - 99 1';
  const controller = createFinishGameController({
    initialFen: fen,
    playerColor: 'white',
    engineColor: 'black',
  });
  assert.equal(controller.submitPlayerMove({ san: 'Kf1' }), true);
  assert.equal(controller.getState().result, '1/2-1/2');
});

test('insufficient material is an official draw', () => {
  const fen = '8/8/8/8/8/8/4p3/4K1k1 w - - 0 1';
  const controller = createFinishGameController({
    initialFen: fen,
    playerColor: 'white',
    engineColor: 'black',
  });
  assert.equal(controller.submitPlayerMove({ san: 'Kxe2' }), true);
  assert.equal(controller.getState().result, '1/2-1/2');
  const board = new Chess(controller.getState().fen);
  assert.equal(board.isInsufficientMaterial(), true);
});

test('never records an exercise score', () => {
  const controller = createFinishGameController({
    initialFen: START,
    playerColor: 'white',
    engineColor: 'black',
  });
  controller.submitPlayerMove({ san: 'e4' });
  assert.equal(controller.getState().exerciseScoreRecorded, false);
});
