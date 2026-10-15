/**
 * The standalone app must not claim the development client's Metro scheme.
 * Expo still applies the expo-dev-client config plugin when the package is
 * installed, and that plugin adds `exp+<slug>` next to the app scheme.
 */
const BLOCKED_SCHEMES = new Set(['expo-dev-launcher']);

function isDevClientScheme(scheme) {
  return scheme.startsWith('exp+') || BLOCKED_SCHEMES.has(scheme);
}

function stripDevClientSchemes(manifest) {
  const applications = manifest?.application ?? [];
  for (const application of applications) {
    for (const activity of application.activity ?? []) {
      for (const intentFilter of activity['intent-filter'] ?? []) {
        if (!Array.isArray(intentFilter.data)) continue;
        intentFilter.data = intentFilter.data.filter((entry) => {
          const scheme = entry?.$?.['android:scheme'];
          if (typeof scheme !== 'string') return true;
          return !isDevClientScheme(scheme);
        });
      }
    }
  }
  return manifest;
}

module.exports = { isDevClientScheme, stripDevClientSchemes };
