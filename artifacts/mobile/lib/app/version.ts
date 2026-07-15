/**
 * Single source of truth for the user-visible application identity.
 *
 * Expo `app.json` / Android versionCode can diverge later; display builds
 * always come from these constants so beta testers report one string.
 */
export const APP_NAME = 'AnyChess';
export const APP_STAGE = 'Beta';
/** Display version (four-part beta scheme). */
export const APP_VERSION = '0.0.0.1';

/** e.g. "AnyChess Beta 0.0.0.1" */
export function formatAppVersionLabel(
  name: string = APP_NAME,
  stage: string = APP_STAGE,
  version: string = APP_VERSION,
): string {
  return `${name} ${stage} ${version}`.trim();
}
