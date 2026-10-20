const { resolveAndroidVariant } = require('./lib/app/androidVariants.cjs');

/** Metro and local builds default to the development client. */
module.exports = () => {
  const requested = process.env.ANYCHESS_VARIANT;
  const variant =
    requested === 'standalone' || requested === 'stable' ? requested : 'development';
  return resolveAndroidVariant(variant);
};
