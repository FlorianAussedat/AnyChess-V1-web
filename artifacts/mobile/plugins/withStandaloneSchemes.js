const { withAndroidManifest, createRunOncePlugin } = require('expo/config-plugins');
const { stripDevClientSchemes } = require('./standaloneSchemes.cjs');

/**
 * Standalone only. The development client keeps exp+mobile so Metro links
 * still open AnyChess Dev.
 */
function withStandaloneSchemes(config) {
  if (process.env.ANYCHESS_VARIANT !== 'standalone') return config;
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
