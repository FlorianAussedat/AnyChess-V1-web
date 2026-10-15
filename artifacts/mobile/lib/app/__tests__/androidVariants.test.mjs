import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const {
  DEV_PACKAGE,
  STANDALONE_PACKAGE,
  DEV_CLIENT_MODULES,
  resolveAndroidVariant,
} = require('../androidVariants.cjs');
const { injectReleaseSigning } = require('../../../plugins/releaseSigning.cjs');
const { patchSettingsGradle, applyDevClientExclude } = require('../../../plugins/standaloneAutolinking.cjs');
const { stripDevClientSchemes } = require('../../../plugins/standaloneSchemes.cjs');

function pluginNames(config) {
  return config.expo.plugins.map((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin));
}

describe('Android install variants', () => {
  const dev = resolveAndroidVariant('development');
  const standalone = resolveAndroidVariant('standalone');

  it('keeps the installed development client id and gives the release a distinct id', () => {
    assert.equal(dev.expo.android.package, DEV_PACKAGE);
    assert.equal(dev.expo.android.package, 'com.anychess.app');
    assert.equal(standalone.expo.android.package, STANDALONE_PACKAGE);
    assert.notEqual(dev.expo.android.package, standalone.expo.android.package);
  });

  it('names the development client AnyChess Dev and the release AnyChess', () => {
    assert.equal(dev.expo.name, 'AnyChess Dev');
    assert.equal(standalone.expo.name, 'AnyChess');
    assert.equal(dev.expo.android.versionCode, 4);
    assert.equal(standalone.expo.android.versionCode, 2);
    assert.equal(dev.expo.version, '0.0.6');
    assert.equal(standalone.expo.version, '0.0.6');
  });

  it('uses a discreet dev launcher and the final icon plus splash for the release', () => {
    assert.equal(dev.expo.icon, './assets/icon/android-dev-icon.png');
    assert.equal(
      dev.expo.android.adaptiveIcon.foregroundImage,
      './assets/icon/android-dev-foreground.png',
    );
    assert.equal(standalone.expo.icon, './assets/images/icon.png');
    assert.equal(standalone.expo.splash.image, './assets/images/icon.png');
    assert.equal(standalone.expo.splash.backgroundColor, '#0B1728');
    assert.equal(
      standalone.expo.android.adaptiveIcon.foregroundImage,
      './assets/icon/android-adaptive-foreground.png',
    );
  });

  it('keeps separate link schemes and does not put account confirmation on either scheme', () => {
    assert.equal(dev.expo.scheme, 'mobile');
    assert.equal(standalone.expo.scheme, 'anychess');
    const eas = JSON.parse(readFileSync(join(root, 'eas.json'), 'utf8'));
    assert.equal(eas.build.development.developmentClient, true);
    assert.equal(eas.build.development.distribution, 'internal');
    assert.equal(eas.build.development.android.buildType, 'apk');
    assert.equal(eas.build.standalone.developmentClient, false);
    assert.equal(eas.build.standalone.distribution, 'internal');
    assert.equal(eas.build.standalone.android.buildType, 'apk');
    assert.equal(eas.build.development.channel, 'development');
    assert.equal(eas.build.standalone.channel, 'standalone');
    assert.equal(dev.expo.extra.easUpdateChannel, 'development');
    assert.equal(standalone.expo.extra.easUpdateChannel, 'standalone');
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    assert.equal(pkg.dependencies['expo-updates'], undefined);
  });

  it('ships the dev client only in the development binary', () => {
    const devPlugins = pluginNames(dev);
    const releasePlugins = pluginNames(standalone);
    assert.ok(devPlugins.includes('expo-dev-client'));
    assert.equal(releasePlugins.includes('expo-dev-client'), false);
    assert.equal(standalone.expo.autolinking.exclude.includes('expo-dev-client'), true);
    for (const name of DEV_CLIENT_MODULES) {
      assert.ok(standalone.expo.autolinking.exclude.includes(name));
    }
    assert.equal(dev.expo.autolinking, undefined);
    for (const native of [
      './modules/stockfish-uci/app.plugin.js',
      'expo-speech-recognition',
    ]) {
      assert.ok(devPlugins.includes(native));
      assert.ok(releasePlugins.includes(native));
    }
    assert.ok(releasePlugins.includes('./plugins/withReleaseSigning.js'));
    assert.ok(releasePlugins.includes('./plugins/withStandaloneAutolinking.js'));
    assert.ok(releasePlugins.includes('./plugins/withStandaloneSchemes.js'));
    assert.equal(devPlugins.includes('./plugins/withStandaloneSchemes.js'), false);
  });

  it('attaches a release keystore without replacing the debug key', () => {
    const template = `
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.debug
        }
    }
`;
    const signed = injectReleaseSigning(template, {
      storeFile: '/keys/standalone.jks',
      storePassword: 'store-secret',
      keyAlias: 'anychess-standalone',
      keyPassword: 'key-secret',
    });
    assert.match(signed, /storeFile file\("\/keys\/standalone\.jks"\)/);
    assert.match(signed, /signingConfig signingConfigs\.release/);
    assert.match(signed, /signingConfig signingConfigs\.debug/);
    assert.equal(signed.includes('signingConfig signingConfigs.debug\n'), true);
    const releaseAt = signed.indexOf('buildTypes {');
    assert.equal(
      signed.indexOf('signingConfig signingConfigs.release', releaseAt) >
        signed.indexOf('release {', releaseAt),
      true,
    );
  });

  it('excludes the development client from the standalone Gradle settings', () => {
    const settings = `
extensions.configure(com.facebook.react.ReactSettingsExtension) { ex ->
  ex.autolinkLibrariesFromCommand(expoAutolinking.rnConfigCommand)
}
expoAutolinking.useExpoModules()
`;
    const patched = patchSettingsGradle(settings);
    assert.ok(patched.indexOf('expoAutolinking.exclude') < patched.indexOf('rnConfigCommand'));
    for (const name of DEV_CLIENT_MODULES) {
      assert.match(patched, new RegExp(name));
    }
    const pkg = applyDevClientExclude({ name: 'app', dependencies: { 'expo-speech': '1' } });
    for (const name of DEV_CLIENT_MODULES) {
      assert.ok(pkg.expo.autolinking.exclude.includes(name));
    }
    assert.equal(pkg.dependencies['expo-speech'], '1');
  });

  it('drops the development client schemes from the standalone manifest', () => {
    const manifest = {
      application: [
        {
          activity: [
            {
              'intent-filter': [
                {
                  data: [
                    { $: { 'android:scheme': 'anychess' } },
                    { $: { 'android:scheme': 'exp+mobile' } },
                    { $: { 'android:scheme': 'expo-dev-launcher' } },
                  ],
                },
              ],
            },
          ],
        },
      ],
      queries: [
        {
          intent: [
            {
              data: [{ $: { 'android:scheme': 'https' } }],
            },
          ],
        },
      ],
    };
    stripDevClientSchemes(manifest);
    const schemes = manifest.application[0].activity[0]['intent-filter'][0].data.map(
      (entry) => entry.$['android:scheme'],
    );
    assert.deepEqual(schemes, ['anychess']);
    assert.equal(
      manifest.queries[0].intent[0].data[0].$['android:scheme'],
      'https',
    );
  });
});
