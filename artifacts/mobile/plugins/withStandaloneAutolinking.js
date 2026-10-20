const { withSettingsGradle, withDangerousMod, createRunOncePlugin } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');
const {
  applyDevClientExclude,
  patchSettingsGradle,
} = require('./standaloneAutolinking.cjs');

/** Standalone builds must not link the Metro development client. */
function withStandaloneAutolinking(config) {
  if (process.env.ANYCHESS_VARIANT !== 'standalone' && process.env.ANYCHESS_VARIANT !== 'stable') {
    return config;
  }
  config = withSettingsGradle(config, (cfg) => {
    cfg.modResults.contents = patchSettingsGradle(cfg.modResults.contents);
    return cfg;
  });
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const pkgPath = path.join(cfg.modRequest.projectRoot, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      fs.writeFileSync(pkgPath, `${JSON.stringify(applyDevClientExclude(pkg), null, 2)}\n`);
      return cfg;
    },
  ]);
}

module.exports = createRunOncePlugin(
  withStandaloneAutolinking,
  'anychess-standalone-autolinking',
  '1.0.0',
);
