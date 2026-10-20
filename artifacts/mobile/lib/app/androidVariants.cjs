/**
 * Two installable Android apps, plus the historical standalone package.
 *
 * Stable is com.anychess.app. It embeds the JavaScript bundle and is signed
 * with the private release keystore outside the generated android/ tree.
 * A debug certificate is refused for this variant.
 *
 * AnyChess Dev is com.anychess.dev. It keeps the Expo development client and
 * its own scheme, so it can be installed beside Stable without sharing storage.
 *
 * com.anychess.standalone stays in the source so a build cannot retarget it by
 * accident. Its original keystore is still required and is not replaced here.
 */
const { expo: base } = require('../../app.json');

const STABLE_PACKAGE = 'com.anychess.app';
const DEV_PACKAGE = 'com.anychess.dev';
const STANDALONE_PACKAGE = 'com.anychess.standalone';
const DEV_CLIENT_MODULES = [
  'expo-dev-client',
  'expo-dev-launcher',
  'expo-dev-menu',
  'expo-dev-menu-interface',
];

function pluginName(plugin) {
  return Array.isArray(plugin) ? plugin[0] : plugin;
}

function withoutDevClient(plugins) {
  return plugins.filter((plugin) => pluginName(plugin) !== 'expo-dev-client');
}

function resolveAndroidVariant(variant) {
  if (variant !== 'development' && variant !== 'stable' && variant !== 'standalone') {
    throw new Error(`Unknown Android variant: ${variant}`);
  }
  const development = variant === 'development';
  const stable = variant === 'stable';
  const plugins = development ? base.plugins : withoutDevClient(base.plugins);
  return {
    expo: {
      ...base,
      name: development ? 'AnyChess Dev' : 'AnyChess',
      slug: development ? 'anychessdev' : base.slug,
      scheme: development ? 'anychessdev' : stable ? 'mobile' : 'anychess',
      icon: development ? './assets/icon/android-dev-icon.png' : base.icon,
      splash: base.splash,
      android: {
        ...base.android,
        package: development ? DEV_PACKAGE : stable ? STABLE_PACKAGE : STANDALONE_PACKAGE,
        versionCode: development ? 1 : stable ? 8 : 2,
        adaptiveIcon: {
          ...base.android.adaptiveIcon,
          foregroundImage: development
            ? './assets/icon/android-dev-foreground.png'
            : base.android.adaptiveIcon.foregroundImage,
        },
      },
      plugins: development
        ? plugins
        : [
            ...plugins,
            './plugins/withStandaloneAutolinking.js',
            './plugins/withReleaseSigning.js',
            './plugins/withStandaloneSchemes.js',
          ],
      autolinking: development ? undefined : { exclude: [...DEV_CLIENT_MODULES] },
      extra: {
        ...(base.extra || {}),
        anychessVariant: variant,
        easUpdateChannel: variant,
      },
    },
  };
}

module.exports = {
  STABLE_PACKAGE,
  DEV_PACKAGE,
  STANDALONE_PACKAGE,
  DEV_CLIENT_MODULES,
  resolveAndroidVariant,
};
