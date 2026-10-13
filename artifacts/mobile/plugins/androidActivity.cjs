/**
 * Keep a single Android activity so Expo Router does not register linking twice.
 * `smallestScreenSize` avoids a second instance when the screen size changes.
 */
const REQUIRED_CONFIG_CHANGES = [
  'keyboard',
  'keyboardHidden',
  'orientation',
  'screenSize',
  'screenLayout',
  'smallestScreenSize',
  'uiMode',
];

function isMainActivity(activity) {
  const name = activity?.$?.['android:name'] ?? '';
  return name === '.MainActivity' || name.endsWith('.MainActivity');
}

function ensureMainActivitySingleTask(manifest) {
  const activities = manifest?.application?.[0]?.activity ?? [];
  for (const activity of activities) {
    if (!isMainActivity(activity)) continue;
    if (!activity.$) activity.$ = {};
    activity.$['android:launchMode'] = 'singleTask';
    const current = String(activity.$['android:configChanges'] ?? '')
      .split('|')
      .filter(Boolean);
    for (const flag of REQUIRED_CONFIG_CHANGES) {
      if (!current.includes(flag)) current.push(flag);
    }
    activity.$['android:configChanges'] = current.join('|');
  }
  return manifest;
}

module.exports = {
  REQUIRED_CONFIG_CHANGES,
  ensureMainActivitySingleTask,
};
