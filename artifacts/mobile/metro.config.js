const { getDefaultConfig } = require('expo/metro-config');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

/**
 * Expo reads .env once, before this file, and does not override variables
 * already present in the shell. A fresh VM or a Metro started without the
 * public Supabase pair would otherwise bundle "Cloud non configuré".
 * Fill them from the gitignored .env (creating it from the existing anon key
 * when SUPABASE_ACCESS_TOKEN is available) before the dev serializer runs.
 */
function applyPublicSupabaseEnv(root) {
  const file = path.join(root, '.env');
  let text = '';
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return false;
  }
  let applied = 0;
  for (const line of text.split('\n')) {
    const match = line.match(/^(EXPO_PUBLIC_SUPABASE_URL|EXPO_PUBLIC_SUPABASE_ANON_KEY)=(.*)$/);
    if (!match || !match[2].trim()) continue;
    process.env[match[1]] = match[2].trim();
    applied += 1;
  }
  return applied === 2;
}

function ensurePublicSupabaseEnv(root) {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (url && anon) return;
  const script = path.join(root, 'scripts', 'ensure-supabase-public-env.mjs');
  if (fs.existsSync(script)) {
    const result = spawnSync(process.execPath, [script], {
      cwd: root,
      env: process.env,
      encoding: 'utf8',
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.status !== 0) {
      const detail = (result.stderr || '').trim();
      if (detail) process.stderr.write(`${detail}\n`);
      console.warn(
        '[anychess] EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are still missing. The User screen will show Cloud non configuré.',
      );
    }
  }
  applyPublicSupabaseEnv(root);
}

ensurePublicSupabaseEnv(__dirname);

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
