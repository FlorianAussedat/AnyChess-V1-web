import { Router, type IRouter, type Request, type Response } from "express";
import {
  fetchDeepLUsage,
  publicUsageSnapshot,
  readDeepLKey,
  ANYCHESS_TRANSLATE_CLIENT,
} from "../lib/deeplClient.ts";
import { logger } from "../lib/logger.ts";
import {
  translatePgnComments,
  translationBackend,
} from "../lib/pgnCommentTranslate.ts";
import {
  consumeTranslateQuota,
  inspectTranslateRequestSize,
} from "../lib/translateRateLimit.ts";

const router: IRouter = Router();

function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}

function hashIp(ip: string): string {
  let hash = 0;
  for (let i = 0; i < ip.length; i += 1) {
    hash = (hash * 31 + ip.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

function hasValidClient(req: Request): boolean {
  return req.get("x-anychess-client") === ANYCHESS_TRANSLATE_CLIENT;
}

function hasValidAppToken(req: Request): boolean {
  const expected = process.env.ANYCHESS_TRANSLATE_APP_TOKEN?.trim();
  if (!expected) return true;
  return req.get("x-anychess-translate-token") === expected;
}

function rejectAccess(req: Request, res: Response): boolean {
  if (!hasValidClient(req) || !hasValidAppToken(req)) {
    logger.info({
      event: "pgnTranslate.denied",
      ipHash: hashIp(clientIp(req)),
    });
    res.status(401).json({ error: "rejected" });
    return true;
  }
  return false;
}

router.post("/pgn-comments/translate", async (req, res) => {
  if (rejectAccess(req, res)) return;
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "items_required" });
    return;
  }
  const size = inspectTranslateRequestSize(items);
  if (size.tooLarge) {
    res.status(413).json({ error: "rejected" });
    return;
  }
  const limited = consumeTranslateQuota(clientIp(req), size.itemCount, size.chars);
  if (!limited.ok) {
    res.setHeader("Retry-After", String(Math.ceil(limited.retryAfterMs / 1000)));
    res.status(429).json({
      error: "rate_limited",
      retryAfterMs: limited.retryAfterMs,
      backend: translationBackend(),
    });
    return;
  }
  const result = await translatePgnComments(items);
  const status =
    result.error === "not_configured"
      ? 503
      : result.error === "quota"
        ? 456
        : result.error === "rate_limited"
          ? 429
          : result.error === "offline"
            ? 503
            : 200;
  if (result.retryAfterMs) {
    res.setHeader("Retry-After", String(Math.ceil(result.retryAfterMs / 1000)));
  }
  logger.info({
    event: "pgnTranslate.batch",
    ipHash: hashIp(clientIp(req)),
    itemCount: size.itemCount,
    chars: size.chars,
    status,
    backend: translationBackend(),
    characterCount: result.usage?.characterCount,
    characterLimit: result.usage?.characterLimit,
  });
  res.status(status).json({
    backend: translationBackend(),
    error: result.error,
    retryAfterMs: result.retryAfterMs,
    usage: publicUsageSnapshot(result.usage),
    items: result.items,
  });
});

router.get("/pgn-comments/usage", async (req, res) => {
  if (rejectAccess(req, res)) return;
  const key = readDeepLKey();
  if (!key) {
    res.status(503).json({
      backend: "not_configured",
      error: "not_configured",
      usage: null,
    });
    return;
  }
  const usage = await fetchDeepLUsage(key);
  res.json({
    backend: "deepl",
    usage: publicUsageSnapshot(usage),
  });
});

export default router;
