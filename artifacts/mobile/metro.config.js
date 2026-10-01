const { getDefaultConfig } = require('expo/metro-config');
const http = require('node:http');

const config = getDefaultConfig(__dirname);

const API_PORT = Number(process.env.ANYCHESS_API_PORT || 8080);

/**
 * Dev-only: forward /api/* to the local AnyChess API (DeepL proxy on 8080)
 * so an Expo tunnel/dev-client can reach POST /api/pgn-comments/translate.
 */
function proxyApi(req, res) {
  const headers = { ...req.headers, host: `127.0.0.1:${API_PORT}` };
  const upstream = http.request(
    {
      hostname: '127.0.0.1',
      port: API_PORT,
      path: req.url,
      method: req.method,
      headers,
    },
    (incoming) => {
      res.writeHead(incoming.statusCode || 502, incoming.headers);
      incoming.pipe(res);
    },
  );
  upstream.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
    }
    res.end(JSON.stringify({ error: 'offline', backend: 'not_configured' }));
  });
  req.pipe(upstream);
}

const previousEnhance = config.server?.enhanceMiddleware;
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware, server) => {
    const inner = previousEnhance ? previousEnhance(middleware, server) : middleware;
    return (req, res, next) => {
      if (typeof req.url === 'string' && req.url.startsWith('/api/')) {
        proxyApi(req, res);
        return;
      }
      return inner(req, res, next);
    };
  },
};

module.exports = config;
