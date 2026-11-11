const { withGradleProperties, createRunOncePlugin } = require('expo/config-plugins');

/** AsyncStorage 2.2.0 reads this root Gradle property into its native BuildConfig.
 * Changing the ceiling preserves the existing SQLite database and its schema.
 * Native rebuild required; OTA/Metro cannot change an installed database limit.
 */
function withAsyncStorageCapacity(config) {
  if (!['development', 'preview'].includes(config.extra?.anychessVariant)) return config;
  return withGradleProperties(config, cfg => {
    cfg.modResults = cfg.modResults.filter(item =>
      item.type !== 'property' || item.key !== 'AsyncStorage_db_size_in_MB');
    cfg.modResults.push({ type: 'property', key: 'AsyncStorage_db_size_in_MB', value: '32' });
    return cfg;
  });
}
module.exports = createRunOncePlugin(withAsyncStorageCapacity, 'anychess-asyncstorage-capacity', '1.0.0');
