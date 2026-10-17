const upstream = require('@expo/metro-config/babel-transformer');
const { patchExpoRouterLinkingSource } = require('./patchExpoRouterLinking');

async function transform(args) {
  const filename = args.filename || '';
  const src = patchExpoRouterLinkingSource(filename, args.src);
  if (src === args.src) return upstream.transform(args);
  return upstream.transform({ ...args, src });
}

module.exports = { transform };
