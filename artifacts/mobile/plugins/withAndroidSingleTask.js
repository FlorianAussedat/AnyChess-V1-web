const { withAndroidManifest, createRunOncePlugin } = require('expo/config-plugins');
const { ensureMainActivitySingleTask } = require('./androidActivity.cjs');

/**
 * Native workaround for Expo Router's Android "linking in multiple places"
 * warning when the activity is recreated.
 *
 * Reference: https://github.com/expo/expo/pull/42644
 * Issue: https://github.com/expo/expo/issues/42500
 * Affected: expo ~54.0.27, expo-router ~6.0.17 (SDK 54).
 * `assetsPaths` avoids a recreation when Android reloads dynamic colors.
 * This plugin does not hide the LogBox. It only takes effect after a new
 * development build (prebuild / EAS). The client already installed keeps its
 * previous manifest, so the running Dev bundle owns the linking session.
 */

const withAndroidSingleTask = (config) =>
  withAndroidManifest(config, (config) => {
    ensureMainActivitySingleTask(config.modResults.manifest);
    return config;
  });

module.exports = createRunOncePlugin(
  withAndroidSingleTask,
  'anychess-android-single-task',
  '1.0.0',
);
