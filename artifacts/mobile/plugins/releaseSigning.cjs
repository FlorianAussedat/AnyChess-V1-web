/**
 * Point the release build type at a dedicated keystore.
 * The Expo template signs release with the debug key unless this runs.
 */
function injectReleaseSigning(contents, signing) {
  for (const key of ['storeFile', 'storePassword', 'keyAlias', 'keyPassword']) {
    if (!signing[key]) throw new Error(`Missing release signing ${key}`);
  }
  const debugBlock = /signingConfigs \{\s*debug \{[\s\S]*?\n        \}\s*\n    \}/;
  if (!debugBlock.test(contents)) {
    throw new Error('debug signingConfigs block not found');
  }
  const releaseConfig = [
    '        release {',
    `            storeFile file(${JSON.stringify(signing.storeFile)})`,
    `            storePassword ${JSON.stringify(signing.storePassword)}`,
    `            keyAlias ${JSON.stringify(signing.keyAlias)}`,
    `            keyPassword ${JSON.stringify(signing.keyPassword)}`,
    '        }',
  ].join('\n');
  let next = contents.replace(debugBlock, (match) =>
    match.replace(/\n    \}$/, `\n${releaseConfig}\n    }`),
  );
  const buildTypesAt = next.indexOf('buildTypes {');
  const releaseAt = next.indexOf('release {', buildTypesAt);
  const signingAt = next.indexOf('signingConfig signingConfigs.debug', releaseAt);
  if (buildTypesAt < 0 || releaseAt < 0 || signingAt < 0) {
    throw new Error('release buildType signingConfig not found');
  }
  const line = 'signingConfig signingConfigs.debug';
  next =
    next.slice(0, signingAt) +
    'signingConfig signingConfigs.release' +
    next.slice(signingAt + line.length);
  if (!next.includes('signingConfig signingConfigs.release')) {
    throw new Error('standalone release signature was not attached');
  }
  if (next.includes('signingConfig signingConfigs.debug\n')) {
    // The debug build type must keep the debug key.
  }
  return next;
}

module.exports = { injectReleaseSigning };
