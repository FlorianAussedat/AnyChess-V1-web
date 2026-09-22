/**
 * Bootstrap / retry helpers for AnyLyseur's AnalysisController.
 *
 * Native builds have no UCI transport: engine.init() rejects and the
 * controller maps that to `unavailable`. These wrappers guarantee that
 * rejection never escapes as an unhandled promise, while leaving the
 * controller's own status/error (including real web Worker failures) intact.
 */
export type DisposableAnalysisController = {
  init(): Promise<void>;
  dispose(): Promise<void> | void;
};

export async function initAnalysisControllerSafely(
  controller: { init(): Promise<void> },
): Promise<void> {
  try {
    await controller.init();
  } catch {
    // AnalysisController.init already records unavailable/error.
    // Outer catch is the last line of defense against unhandled rejections.
  }
}

export async function replaceAnalysisController<
  T extends DisposableAnalysisController,
>(options: {
  previous: T | null;
  create: () => T;
  isStale: () => boolean;
}): Promise<T | null> {
  if (options.previous) {
    await options.previous.dispose();
  }
  if (options.isStale()) return null;

  const next = options.create();
  if (options.isStale()) {
    await next.dispose();
    return null;
  }

  await initAnalysisControllerSafely(next);
  if (options.isStale()) {
    await next.dispose();
    return null;
  }
  return next;
}
