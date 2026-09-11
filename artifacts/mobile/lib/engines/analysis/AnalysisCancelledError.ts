/** Thrown / flagged when a search is stopped before a valid bestmove. */
export class AnalysisCancelledError extends Error {
  readonly cancelled = true as const;

  constructor(message = '[ChessEngineService] Analysis cancelled.') {
    super(message);
    this.name = 'AnalysisCancelledError';
  }
}

export function isAnalysisCancelled(err: unknown): boolean {
  return (
    err instanceof AnalysisCancelledError ||
    (typeof err === 'object' &&
      err != null &&
      (err as { cancelled?: boolean }).cancelled === true)
  );
}
