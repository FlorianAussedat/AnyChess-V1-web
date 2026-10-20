/**
 * Single source of truth for the user-visible application identity.
 *
 * Expo `app.json` / Android versionCode can diverge later; display builds
 * always come from these constants so beta testers report one string.
 */
export const APP_NAME = 'AnyChess';
export const APP_STAGE = 'Beta';
/** Display version (Major Update scheme). */
export const APP_VERSION = '0.0.7';

/** e.g. "AnyChess V0.0.7". The stage stays available for diagnostics. */
export function formatAppVersionLabel(
  name: string = APP_NAME,
  _stage: string = APP_STAGE,
  version: string = APP_VERSION,
): string {
  return `${name} V${version}`.trim();
}
