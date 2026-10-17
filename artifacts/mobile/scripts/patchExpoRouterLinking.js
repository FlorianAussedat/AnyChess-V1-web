/**
 * Metro source patch for expo-router 6.0.24.
 * The installed Dev client loads this through the bundle. It does not change
 * the native manifest and it does not hide the duplicate-root error.
 */
const LINKING_ERROR = [
  'Looks like you have configured linking in multiple places. This is likely an error since deep links should only be handled in one place to avoid conflicts. Make sure that:',
  '"- You don\'t have multiple NavigationContainers in the app each with \'linking\' enabled"',
  "'- Only a single instance of the root component is rendered'",
  "react_native_1.Platform.OS === 'android'",
  '"- You have set \'android:launchMode=singleTask\' in the \'<activity />\' section of the \'AndroidManifest.xml\' file to avoid launching multiple instances"',
].join('\n');

const USE_LINKING_EFFECT = `React.useEffect(() => {
        if (process.env.NODE_ENV === 'production') {
            return undefined;
        }
        if (independent) {
            return undefined;
        }
        if (enabled !== false && linkingHandlers.length) {
            console.error([
                'Looks like you have configured linking in multiple places. This is likely an error since deep links should only be handled in one place to avoid conflicts. Make sure that:',
                "- You don't have multiple NavigationContainers in the app each with 'linking' enabled",
                '- Only a single instance of the root component is rendered',
                react_native_1.Platform.OS === 'android'
                    ? "- You have set 'android:launchMode=singleTask' in the '<activity />' section of the 'AndroidManifest.xml' file to avoid launching multiple instances"
                    : '',
            ]
                .join('\\n')
                .trim());
        }
        const handler = Symbol();
        if (enabled !== false) {
            linkingHandlers.push(handler);
        }
        return () => {
            const index = linkingHandlers.indexOf(handler);
            if (index > -1) {
                linkingHandlers.splice(index, 1);
            }
        };
    }, [enabled, independent]);`;

const USE_LINKING_REPLACEMENT = `React.useEffect(() => {
        if (process.env.NODE_ENV === 'production') {
            return undefined;
        }
        if (independent) {
            return undefined;
        }
        if (enabled === false) {
            return undefined;
        }
        const anychessLinkingSession = require('anychess-linking-session');
        const root = anychessLinkingSession.claimLinkingRoot();
        const result = anychessLinkingSession.evaluateLinkingRoots();
        if (result.conflict && result.reported) {
            console.error([
                'Looks like you have configured linking in multiple places. This is likely an error since deep links should only be handled in one place to avoid conflicts. Make sure that:',
                "- You don't have multiple NavigationContainers in the app each with 'linking' enabled",
                '- Only a single instance of the root component is rendered',
                react_native_1.Platform.OS === 'android'
                    ? "- You have set 'android:launchMode=singleTask' in the '<activity />' section of the 'AndroidManifest.xml' file to avoid launching multiple instances"
                    : '',
            ]
                .join('\\n')
                .trim());
        }
        return () => {
            anychessLinkingSession.releaseLinkingRoot(root);
        };
    }, [enabled, independent]);`;

const SUBSCRIBE_BLOCK = `        const subscription = Linking.addEventListener('url', callback);
        return () => {
            // https://github.com/facebook/react-native/commit/6d1aca806cee86ad76de771ed3a1cc62982ebcd7
            subscription?.remove?.();
            legacySubscription?.();
        };`;

const SUBSCRIBE_REPLACEMENT = `        const anychessLinkingSession = require('anychess-linking-session');
        const releaseUrlSubscription = anychessLinkingSession.retainUrlSubscription(() => Linking.addEventListener('url', callback));
        return () => {
            // https://github.com/facebook/react-native/commit/6d1aca806cee86ad76de771ed3a1cc62982ebcd7
            releaseUrlSubscription();
            legacySubscription?.();
        };`;

function isUseLinkingNative(filename) {
  return filename.replace(/\\/g, '/').endsWith('/expo-router/build/fork/useLinking.native.js');
}

function isRouterLinking(filename) {
  return filename.replace(/\\/g, '/').endsWith('/expo-router/build/link/linking.js');
}

function patchExpoRouterLinkingSource(filename, source) {
  if (typeof source !== 'string') return source;
  if (isUseLinkingNative(filename)) {
    if (source.includes("require('anychess-linking-session')") && source.includes('claimLinkingRoot')) {
      return source;
    }
    if (!source.includes(USE_LINKING_EFFECT)) {
      throw new Error('expo-router useLinking.native.js no longer matches the linking-root patch');
    }
    const next = source.replace(USE_LINKING_EFFECT, USE_LINKING_REPLACEMENT);
    if (!next.includes(LINKING_ERROR.split('\n')[0])) {
      throw new Error('linking error text was removed');
    }
    return next;
  }
  if (isRouterLinking(filename)) {
    if (source.includes('retainUrlSubscription')) return source;
    if (!source.includes(SUBSCRIBE_BLOCK)) {
      throw new Error('expo-router linking.js no longer matches the single-subscription patch');
    }
    if (!source.includes('redirectSystemPath')) {
      throw new Error('auth redirect hook is missing from linking.js');
    }
    return source.replace(SUBSCRIBE_BLOCK, SUBSCRIBE_REPLACEMENT);
  }
  return source;
}

module.exports = {
  LINKING_ERROR,
  patchExpoRouterLinkingSource,
};
