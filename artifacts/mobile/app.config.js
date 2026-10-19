const { resolveAndroidVariant } = require('./lib/app/androidVariants.cjs');

/** Metro and local builds default to the development client. */
module.exports = () => {
  const requested = process.env.ANYCHESS_VARIANT;
  const variant =
    requested === 'standalone' || requested === 'device' ? requested : 'development';
  return resolveAndroidVariant(variant);
};
