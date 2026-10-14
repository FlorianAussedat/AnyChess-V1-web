const { resolveAndroidVariant } = require('./lib/app/androidVariants.cjs');

/** Metro and local builds default to the development client. */
module.exports = () => {
  const variant =
    process.env.ANYCHESS_VARIANT === 'standalone' ? 'standalone' : 'development';
  return resolveAndroidVariant(variant);
};
