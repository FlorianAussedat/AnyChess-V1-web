// @ts-check
/**
 * G1: Android 10+ W^X blocks execve of files written to filesDir.
 * Stockfish is a real ELF executable shipped as jniLibs/arm64-v8a/libstockfish.so.
 * Legacy packaging extracts it to nativeLibraryDir so ProcessBuilder can spawn it.
 */
const {
  withGradleProperties,
  withAndroidManifest,
  createRunOncePlugin,
} = require('expo/config-plugins');

const PKG = 'stockfish-uci';
const VERSION = '0.1.1';

/**
 * @param {import('expo/config-plugins').PropertiesItem[]} props
 * @param {string} key
 * @param {string} value
 */
function upsertGradleProperty(props, key, value) {
  const existing = props.find((p) => p.type === 'property' && p.key === key);
  if (existing && existing.type === 'property') {
    existing.value = value;
  } else {
    props.push({ type: 'property', key, value });
  }
}

/** @type {import('expo/config-plugins').ConfigPlugin} */
const withStockfishUci = (config) => {
  config = withGradleProperties(config, (config) => {
    upsertGradleProperty(config.modResults, 'expo.useLegacyPackaging', 'true');
    upsertGradleProperty(
      config.modResults,
      'android.packagingOptions.doNotStrip',
      '**/libstockfish.so',
    );
    return config;
  });

  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    if (!manifest.$) manifest.$ = {};
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }
    const app = manifest.application?.[0];
    if (app?.$) {
      app.$['android:extractNativeLibs'] = 'true';
      const replace = app.$['tools:replace'];
      if (!replace) {
        app.$['tools:replace'] = 'android:extractNativeLibs';
      } else if (!String(replace).includes('android:extractNativeLibs')) {
        app.$['tools:replace'] = `${replace},android:extractNativeLibs`;
      }
    }
    return config;
  });

  return config;
};

module.exports = createRunOncePlugin(withStockfishUci, PKG, VERSION);
