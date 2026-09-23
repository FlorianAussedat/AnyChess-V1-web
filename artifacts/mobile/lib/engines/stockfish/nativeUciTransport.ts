/**
 * Injectable native Stockfish UCI bridge (no Expo / RN imports).
 * `transport.ts` binds this to `requireOptionalNativeModule('StockfishUci')`.
 */
export type NativeStockfishEvent = {
  line?: string;
  message?: string;
  code?: number;
};

export type NativeStockfishSubscription = {
  remove(): void;
};

export type NativeStockfishBridge = {
  start(): Promise<unknown>;
  send(command: string): void;
  terminate(): void | Promise<unknown>;
  addListener(
    eventName: 'onLine' | 'onExit' | 'onError' | string,
    listener: (event: NativeStockfishEvent) => void,
  ): NativeStockfishSubscription;
};

export type NativeUciTransportOptions = {
  /** Called when the native process exits or errors after start. */
  onNativeFault?: (reason: string) => void;
};

function splitLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * `UciTransport` adapter around a native stdin/stdout Stockfish process.
 * Same callbacks as `transport.web.ts`. Lifecycle guards:
 * - terminate is idempotent
 * - send after terminate is a no-op
 * - start after terminate throws
 */
export function createNativeUciTransport(
  bridge: NativeStockfishBridge,
  options: NativeUciTransportOptions = {},
): import('./types').UciTransport {
  let onLine: ((line: string) => void) | null = null;
  let subscriptions: NativeStockfishSubscription[] = [];
  let started = false;
  let terminated = false;

  const emit = (raw: string) => {
    const cb = onLine;
    if (!cb) return;
    for (const line of splitLines(raw)) cb(line);
  };

  const detach = () => {
    for (const sub of subscriptions) {
      try {
        sub.remove();
      } catch {
        /* ignore */
      }
    }
    subscriptions = [];
  };

  return {
    async start(cb) {
      if (terminated) {
        throw new Error('[StockfishUci] Cannot start after terminate().');
      }
      onLine = cb;
      if (started) return;

      subscriptions = [
        bridge.addListener('onLine', (event) => {
          if (typeof event?.line === 'string') emit(event.line);
        }),
        bridge.addListener('onError', (event) => {
          const message = typeof event?.message === 'string' ? event.message : 'native engine error';
          options.onNativeFault?.(message);
          emit(`info string native-error ${message}`);
        }),
        bridge.addListener('onExit', (event) => {
          const code = event?.code;
          const reason = `native-exit ${code ?? '?'}`;
          options.onNativeFault?.(reason);
          emit(`info string ${reason}`);
        }),
      ];

      await bridge.start();
      if (terminated) {
        try {
          void bridge.terminate();
        } catch {
          /* ignore */
        }
        detach();
        throw new Error('[StockfishUci] Terminated before native start completed.');
      }
      started = true;
    },

    send(command: string) {
      if (terminated || !started) return;
      const line = command.replace(/\r?\n/g, '').trim();
      if (!line) return;
      try {
        bridge.send(line);
      } catch {
        /* process already gone */
      }
    },

    terminate() {
      if (terminated) return;
      terminated = true;
      started = false;
      onLine = null;
      try {
        void bridge.terminate();
      } catch {
        /* ignore double-terminate at the native layer */
      }
      detach();
    },
  };
}
