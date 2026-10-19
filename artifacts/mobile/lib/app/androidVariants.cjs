/**
 * Two installable Android apps from one source tree.
 *
 * The development client keeps the identifier and the Expo debug signature
 * already installed as com.anychess.app, so a newer versionCode can replace
 * it without wiping its data.
 *
 * The standalone app uses a different identifier. Nothing else in the project
 * reserved a second publication id; com.anychess.app is the only one that
 * existed, and it stays with the development client.
 *
 * The device build is the installable V0.0.7 update of that same identifier.
 * It embeds the JavaScript bundle, omits the Metro client, and keeps the
 * debug signature so Android can replace the installed app without wiping data.
 *
 * Custom schemes differ so the two apps do not compete for the same links.
 * Account confirmation stays on the HTTPS page, not on either scheme.
 */
const { expo: base } = require('../../app.json');

const DEV_PACKAGE = 'com.anychess.app';
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
  if (variant !== 'development' && variant !== 'standalone' && variant !== 'device') {
    throw new Error(`Unknown Android variant: ${variant}`);
  }
  const development = variant === 'development';
  const device = variant === 'device';
  const plugins = development ? base.plugins : withoutDevClient(base.plugins);
  const installedPackage = development || device;
  return {
    expo: {
      ...base,
      name: development ? 'AnyChess Dev' : 'AnyChess',
      // The installed app answers mobile and exp+mobile. Keep both so account
      // confirmation still opens this update. The separate standalone package
      // keeps the anychess scheme.
      scheme: device ? ['mobile', 'exp+mobile'] : development ? 'mobile' : 'anychess',
      icon: development ? './assets/icon/android-dev-icon.png' : base.icon,
      splash: base.splash,
      android: {
        ...base.android,
        package: installedPackage ? DEV_PACKAGE : STANDALONE_PACKAGE,
        versionCode: development ? 6 : device ? 5 : 2,
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
            ...(device
              ? []
              : ['./plugins/withReleaseSigning.js', './plugins/withStandaloneSchemes.js']),
          ],
      autolinking: development
        ? undefined
        : { exclude: [...DEV_CLIENT_MODULES] },
      extra: {
        ...(base.extra || {}),
        anychessVariant: variant,
        easUpdateChannel: development ? 'development' : device ? 'device' : 'standalone',
      },
    },
  };
}

module.exports = {
  DEV_PACKAGE,
  STANDALONE_PACKAGE,
  DEV_CLIENT_MODULES,
  resolveAndroidVariant,
};
