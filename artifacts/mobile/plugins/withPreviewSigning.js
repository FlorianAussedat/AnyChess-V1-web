const { withAppBuildGradle, createRunOncePlugin } = require('expo/config-plugins');
const { injectPreviewSigningGuard } = require('./previewSigning.cjs');

/** Preview uses EAS remote credentials; never load Stable's .signing/release.env. */
function withPreviewSigning(config) {
  if (process.env.ANYCHESS_VARIANT !== 'preview') return config;
  return withAppBuildGradle(config, cfg => {
    cfg.modResults.contents = injectPreviewSigningGuard(cfg.modResults.contents);
    return cfg;
  });
}
module.exports = createRunOncePlugin(withPreviewSigning, 'anychess-preview-signing', '1.0.0');
