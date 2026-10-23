/**
 * Dev, Preview and Stable, plus the historical standalone package.
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
const PREVIEW_PACKAGE = 'com.anychess.preview';
const PREVIEW_EAS_OWNER = 'anychess';
const PREVIEW_EAS_PROJECT_ID = 'f42b44f4-73ce-4752-82d9-38d12f094d55';
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

function resolveAndroidVariant(variant, env = process.env) {
  if (variant !== 'development' && variant !== 'stable' && variant !== 'standalone' && variant !== 'preview') {
    throw new Error(`Unknown Android variant: ${variant}`);
  }
  const development = variant === 'development';
  const stable = variant === 'stable';
  const preview = variant === 'preview';
  const projectId = preview ? (env.ANYCHESS_PREVIEW_EAS_PROJECT_ID?.trim() || PREVIEW_EAS_PROJECT_ID) : undefined;
  const owner = preview ? (env.ANYCHESS_PREVIEW_EAS_OWNER?.trim() || PREVIEW_EAS_OWNER) : undefined;
  if (preview && projectId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
    throw new Error('Invalid ANYCHESS_PREVIEW_EAS_PROJECT_ID');
  }
  const plugins = development ? base.plugins : withoutDevClient(base.plugins);
  return {
    expo: {
      ...base,
      name: development ? 'AnyChess Dev' : preview ? 'AnyChess Preview' : 'AnyChess',
      ...(preview && owner ? { owner } : {}),
      slug: development ? 'anychessdev' : preview ? 'anychess' : base.slug,
      scheme: development ? 'anychessdev' : preview ? 'anychesspreview' : stable ? 'mobile' : 'anychess',
      icon: development ? './assets/icon/android-dev-icon.png' : base.icon,
      splash: base.splash,
      android: {
        ...base.android,
        package: development ? DEV_PACKAGE : preview ? PREVIEW_PACKAGE : stable ? STABLE_PACKAGE : STANDALONE_PACKAGE,
        versionCode: development ? 1 : preview ? 1 : stable ? 8 : 2,
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
            preview ? './plugins/withPreviewSigning.js' : './plugins/withReleaseSigning.js',
            './plugins/withStandaloneSchemes.js',
          ],
      autolinking: development ? undefined : { exclude: [...DEV_CLIENT_MODULES] },
      extra: {
        ...(base.extra || {}),
        ...(preview && projectId ? { eas: { projectId } } : {}),
        anychessVariant: variant,
        easUpdateChannel: variant,
      },
    },
  };
}

module.exports = {
  STABLE_PACKAGE,
  DEV_PACKAGE,
  PREVIEW_PACKAGE,
  STANDALONE_PACKAGE,
  DEV_CLIENT_MODULES,
  resolveAndroidVariant,
};
