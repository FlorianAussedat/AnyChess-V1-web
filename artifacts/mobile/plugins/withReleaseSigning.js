const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { withAppBuildGradle, createRunOncePlugin } = require('expo/config-plugins');
const { injectReleaseSigning, loadGitignoredSigningEnv } = require('./releaseSigning.cjs');

/**
 * Stable and the historical standalone package. AnyChess Dev keeps the debug
 * key on com.anychess.dev and does not use the release keystore.
 *
 * Stable must present signing/stable-release-cert.json. The historical
 * standalone package must present signing/standalone-release-cert.json.
 * The public Expo debug certificate is refused for both.
 */
function assertOriginalReleaseCertificate() {
  const script = path.join(__dirname, '..', 'scripts', 'verify-release-keystore.mjs');
  const result = spawnSync(process.execPath, [script], {
    cwd: path.join(__dirname, '..'),
    env: process.env,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    const detail = `${result.stderr || ''}${result.stdout || ''}`.trim();
    throw new Error(detail || 'Release keystore does not match the installed standalone certificate');
  }
}

function withReleaseSigning(config) {
  if (process.env.ANYCHESS_VARIANT !== 'standalone' && process.env.ANYCHESS_VARIANT !== 'stable') {
    return config;
  }
  loadGitignoredSigningEnv();
  assertOriginalReleaseCertificate();
  const signing = {
    storeFile: process.env.ANYCHESS_RELEASE_STORE_FILE,
    storePassword: process.env.ANYCHESS_RELEASE_STORE_PASSWORD,
    keyAlias: process.env.ANYCHESS_RELEASE_KEY_ALIAS,
    keyPassword: process.env.ANYCHESS_RELEASE_KEY_PASSWORD,
  };
  return withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = injectReleaseSigning(cfg.modResults.contents, signing);
    return cfg;
  });
}

module.exports = createRunOncePlugin(
  withReleaseSigning,
  'anychess-release-signing',
  '1.0.0',
);
