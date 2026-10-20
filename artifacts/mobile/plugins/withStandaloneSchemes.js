const { withAndroidManifest, createRunOncePlugin } = require('expo/config-plugins');
const { stripDevClientSchemes } = require('./standaloneSchemes.cjs');

/**
 * Stable and the historical standalone package must not claim the Dev Client
 * scheme. AnyChess Dev keeps exp+anychessdev for Metro.
 */
function withStandaloneSchemes(config) {
  if (process.env.ANYCHESS_VARIANT !== 'standalone' && process.env.ANYCHESS_VARIANT !== 'stable') {
    return config;
  }
  return withAndroidManifest(config, (cfg) => {
    stripDevClientSchemes(cfg.modResults.manifest);
    return cfg;
  });
}

module.exports = createRunOncePlugin(
  withStandaloneSchemes,
  'anychess-standalone-schemes',
  '1.0.0',
);
