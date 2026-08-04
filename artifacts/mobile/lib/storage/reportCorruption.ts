/**
 * Dev-facing corruption reporting. Never surfaces raw storage errors to end users.
 */

export type StorageCorruptionReport = {
  key: string;
  reason: 'invalid_json' | 'validation_failed';
  /** Truncated raw payload for diagnostics. */
  preview: string;
};

const recentReports: StorageCorruptionReport[] = [];
const MAX_REPORTS = 20;

export function reportStorageCorruption(report: StorageCorruptionReport): void {
  recentReports.push(report);
  if (recentReports.length > MAX_REPORTS) recentReports.shift();

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // eslint-disable-next-line no-console
    console.warn(
      `[AnyChess storage] corrupt data for "${report.key}" (${report.reason}):`,
      report.preview,
    );
  }
}

/** Test / diagnostics helper. */
export function getRecentStorageCorruptionReports(): readonly StorageCorruptionReport[] {
  return recentReports;
}

/** Test helper. */
export function clearStorageCorruptionReports(): void {
  recentReports.length = 0;
}
