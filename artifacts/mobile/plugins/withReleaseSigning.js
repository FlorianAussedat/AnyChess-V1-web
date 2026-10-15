const { withAppBuildGradle, createRunOncePlugin } = require('expo/config-plugins');
const { injectReleaseSigning } = require('./releaseSigning.cjs');

/**
 * Standalone release APK only. The development client keeps the Expo debug key
 * so it can update com.anychess.app.
 */
function withReleaseSigning(config) {
  if (process.env.ANYCHESS_VARIANT !== 'standalone') return config;
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
