/**
 * Minimal UCI protocol smoke test used by the DEV harness and unit tests.
 *
 * Sequence:
 * start → uci/uciok → isready/readyok → position → go depth 10 → info + bestmove
 * → second search → stop → terminate
 */
import type { UciTransport } from './types.ts';

export class UciHarnessError extends Error {
  readonly step: string;
  constructor(step: string, message: string) {
    super(`[StockfishUci] ${step}: ${message}`);
    this.name = 'UciHarnessError';
    this.step = step;
  }
}

export type UciHarnessStepId =
  | 'start'
  | 'uciok'
  | 'readyok'
  | 'info'
  | 'bestmove'
  | 'stop'
  | 'terminate';

export type UciHarnessLog = {
  step: UciHarnessStepId | 'search2';
  ok: boolean;
  detail?: string;
  at: number;
};

export type UciHarnessResult = {
  ok: true;
  logs: UciHarnessLog[];
  infoLines: string[];
  bestmove: string;
  stoppedBestmove: string;
};

export type UciHarnessTimeouts = {
  startMs: number;
  handshakeMs: number;
  searchMs: number;
  stopMs: number;
};

const DEFAULT_TIMEOUTS: UciHarnessTimeouts = {
  startMs: 20_000,
  handshakeMs: 15_000,
  searchMs: 30_000,
  stopMs: 8_000,
};

function waitForLine(
  state: { inbox: string[]; cursor: number },
  waiters: Array<{ pred: (line: string) => boolean; resolve: (line: string) => void }>,
  pred: (line: string) => boolean,
  timeoutMs: number,
  step: string,
): Promise<string> {
  const scan = (): string | null => {
    for (let i = state.cursor; i < state.inbox.length; i++) {
      const line = state.inbox[i];
      if (pred(line)) {
        state.cursor = i + 1;
        return line;
      }
    }
    return null;
  };

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const finish = (line: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(line);
    };
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      const idx = waiters.findIndex((w) => w.resolve === finish);
      if (idx >= 0) waiters.splice(idx, 1);
      reject(new UciHarnessError(step, `timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    waiters.push({ pred, resolve: finish });
    const existing = scan();
    if (existing) {
      const idx = waiters.findIndex((w) => w.resolve === finish);
      if (idx >= 0) waiters.splice(idx, 1);
      finish(existing);
    }
  });
}

export async function runUciSmokeTest(
  transport: UciTransport,
  timeouts: Partial<UciHarnessTimeouts> = {},
): Promise<UciHarnessResult> {
  const t = { ...DEFAULT_TIMEOUTS, ...timeouts };
  const logs: UciHarnessLog[] = [];
  const lineState = { inbox: [] as string[], cursor: 0 };
  const infoLines: string[] = [];
  const waiters: Array<{ pred: (line: string) => boolean; resolve: (line: string) => void }> = [];
  const startedAt = Date.now();
  const log = (
    step: UciHarnessLog['step'],
    ok: boolean,
    detail?: string,
  ) => {
    logs.push({ step, ok, detail, at: Date.now() - startedAt });
  };

  const onLine = (line: string) => {
    lineState.inbox.push(line);
    if (line.startsWith('info ')) infoLines.push(line);
    for (let i = waiters.length - 1; i >= 0; i--) {
      if (waiters[i].pred(line)) {
        const waiter = waiters[i];
        waiters.splice(i, 1);
        lineState.cursor = Math.max(lineState.cursor, lineState.inbox.length);
        waiter.resolve(line);
      }
    }
  };

  try {
    await Promise.race([
      transport.start(onLine),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new UciHarnessError('start', `timeout after ${t.startMs}ms`)),
          t.startMs,
        );
      }),
    ]);
    log('start', true, 'Engine started');
  } catch (err) {
    log('start', false, err instanceof Error ? err.message : String(err));
    try {
      transport.terminate();
    } catch {
      /* ignore */
    }
    throw err instanceof UciHarnessError
      ? err
      : new UciHarnessError('start', err instanceof Error ? err.message : String(err));
  }

  try {
    transport.send('uci');
    const uciok = await waitForLine(
      lineState,
      waiters,
      (line) => line === 'uciok' || line.startsWith('uciok'),
      t.handshakeMs,
      'uciok',
    );
    log('uciok', true, uciok);

    transport.send('isready');
    const readyok = await waitForLine(
      lineState,
      waiters,
      (line) => line === 'readyok' || line.startsWith('readyok'),
      t.handshakeMs,
      'readyok',
    );
    log('readyok', true, readyok);

    transport.send('position startpos moves e2e4 e7e5');
    transport.send('go depth 10');

    const info = await waitForLine(
      lineState,
      waiters,
      (line) => line.startsWith('info '),
      t.searchMs,
      'info',
    );
    log('info', true, info);

    const bestmove = await waitForLine(
      lineState,
      waiters,
      (line) => line.startsWith('bestmove '),
      t.searchMs,
      'bestmove',
    );
    log('bestmove', true, bestmove);

    transport.send('go depth 20');
    await waitForLine(
      lineState,
      waiters,
      (line) => line.startsWith('info '),
      t.searchMs,
      'search2',
    );
    log('search2', true, 'second search started');

    transport.send('stop');
    const stopped = await waitForLine(
      lineState,
      waiters,
      (line) => line.startsWith('bestmove '),
      t.stopMs,
      'stop',
    );
    log('stop', true, stopped);

    transport.terminate();
    log('terminate', true, 'terminate OK');

    return {
      ok: true,
      logs,
      infoLines,
      bestmove,
      stoppedBestmove: stopped,
    };
  } catch (err) {
    const step = err instanceof UciHarnessError ? err.step : 'terminate';
    log(step as UciHarnessLog['step'], false, err instanceof Error ? err.message : String(err));
    try {
      transport.terminate();
    } catch {
      /* ignore */
    }
    throw err instanceof UciHarnessError
      ? err
      : new UciHarnessError(step, err instanceof Error ? err.message : String(err));
  }
}
