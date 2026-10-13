const { withAndroidManifest, createRunOncePlugin } = require('expo/config-plugins');
const { ensureMainActivitySingleTask } = require('./androidActivity.cjs');

/** One MainActivity, singleTask, so a dev-client URL does not start a second root. */
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
