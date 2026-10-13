/**
 * Node child-process transport for the bundled Stockfish 18 lite WASM.
 * Used by the grading checks. The app keeps its own platform transport.
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { UciTransport } from '../../engines/stockfish/types.ts';

export function createWasmStockfishTransport(enginePath: string): UciTransport {
  let child: ChildProcessWithoutNullStreams | null = null;
  return {
    start(onLine: (line: string) => void): Promise<void> {
      child = spawn(process.execPath, [enginePath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const output = createInterface({ input: child.stdout });
      output.on('line', (line) => onLine(line));
      return Promise.resolve();
    },
    send(command: string): void {
      child?.stdin.write(`${command}\n`);
    },
    terminate(): void {
      try {
        child?.stdin.end();
      } catch {
        /* already closed */
      }
      child?.kill();
      child = null;
    },
  };
}
