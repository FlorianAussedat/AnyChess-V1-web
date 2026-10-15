/**
 * Keep the development client out of the standalone native build.
 * Autolinking reads this list from Gradle, not from app.config.js.
 */
const DEV_CLIENT_MODULES = [
  'expo-dev-client',
  'expo-dev-launcher',
  'expo-dev-menu',
  'expo-dev-menu-interface',
];

function patchSettingsGradle(contents) {
  const marker = 'extensions.configure(com.facebook.react.ReactSettingsExtension)';
  if (!contents.includes(marker)) {
    throw new Error('React settings block not found');
  }
  if (contents.includes('expoAutolinking.exclude')) return contents;
  const list = DEV_CLIENT_MODULES.map((name) => `  "${name}",`).join('\n');
  return contents.replace(
    marker,
    `expoAutolinking.exclude = [\n${list}\n]\n${marker}`,
  );
}

function applyDevClientExclude(packageJson) {
  const expo = packageJson.expo && typeof packageJson.expo === 'object' ? packageJson.expo : {};
  const autolinking =
    expo.autolinking && typeof expo.autolinking === 'object' ? expo.autolinking : {};
  const exclude = new Set(
    Array.isArray(autolinking.exclude) ? autolinking.exclude : [],
  );
  for (const name of DEV_CLIENT_MODULES) exclude.add(name);
  return {
    ...packageJson,
    expo: {
      ...expo,
      autolinking: {
        ...autolinking,
        exclude: [...exclude],
      },
    },
  };
}

module.exports = { DEV_CLIENT_MODULES, patchSettingsGradle, applyDevClientExclude };
