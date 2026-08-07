/**
 * Optimize / resize active AnyChess production brand PNGs with sharp.
 *
 * Scope: only files listed in ACTIVE_BRAND_ASSETS (mirrors BrandAssets.ts).
 *
 * Stages:
 *   1) default / --optimize-only  — lossless PNG recompress (no dimension change)
 *   2) --resize                   — downscale to RESIZE_TARGETS then lossless PNG
 *
 * Rules:
 * - PNG only, preserve alpha, never upscale, never stretch (fit: inside)
 * - brandArtBounds use canvas fractions → proportional resize needs no bound edits
 * - Skips write-back when output is not smaller (optimize) or not needed (resize)
 *
 * Usage (from artifacts/mobile):
 *   node scripts/optimize-brand-assets.mjs
 *   node scripts/optimize-brand-assets.mjs --dry-run
 *   node scripts/optimize-brand-assets.mjs --resize
 *   node scripts/optimize-brand-assets.mjs --resize --dry-run
 *   pnpm run optimize:brand
 *   pnpm run optimize:brand:resize
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const brandRoot = path.resolve(__dirname, '../assets/brand');
const dryRun = process.argv.includes('--dry-run');
const doResize = process.argv.includes('--resize');
const optimizeOnly = process.argv.includes('--optimize-only');

/**
 * Paths relative to assets/brand — keep in sync with constants/BrandAssets.ts.
 */
export const ACTIVE_BRAND_ASSETS = [
  'logo-mark.png',
  'splash-brand.png',
  'anychess-horizontal-logo.png',
  'nav/home-nav.png',
  'modes/classic.png',
  'modes/openings.png',
  'modes/blind.png',
  'modes/tactics.png',
  'modes/visualisation.png',
  'modes/quiz-ouverture.png',
  'modes/target.png',
  'mascots/mascot-classic-knight-soundwave.png',
  'mascots/mascot-openings-knight-reading.png',
  'mascots/mascot-blind-knight-blindfold.png',
  'mascots/mascot-tactics-knight-calculator.png',
  'mascots/mascot-visualisation-knight-binoculars.png',
  'mascots/mascot-quiz-knight-detective.png',
  'sides/white.png',
  'sides/black.png',
  'sides/random.png',
  'toggles/board-on.png',
  'toggles/board-off.png',
  'toggles/mic-on.png',
  'toggles/mic-off.png',
  'toggles/coords-on.png',
  'toggles/coords-off.png',
  'toggles/sound-on.png',
  'toggles/sound-off.png',
];

/**
 * Max target canvas size (px). Aspect ratio is preserved via fit:'inside'.
 *
 * Derived from actual RN layout (Aug 2026), then ×3 retina + safety margin:
 * - logo-mark: splash ≤200px → 640
 * - splash-brand: BrandAssets only (unused in UI today); half-res portrait reserve
 * - horizontal logo: full PNG drawn ≈402×268 (220px visible art) → 1200×800
 * - nav home: full PNG drawn ≈70×105 in 32px viewport → 256×384
 * - mode icons: 48×48 list icons → 288 (extra margin vs bare 144)
 * - mascots: ModeCard full PNG ≈276×414 → 864×1296 (~3.1×)
 * - sides white/black: 48×48 pills → 216
 * - toggles: up to 72px (HiddenBoardPlaceholder) → 256
 * - target / random: already 160×180 — omit (leave untouched)
 */
export const RESIZE_TARGETS = {
  'logo-mark.png': { maxWidth: 640, maxHeight: 640, reason: 'splash ≤200px; side mark 32px' },
  'splash-brand.png': {
    maxWidth: 640,
    maxHeight: 960,
    reason: 'unused in UI today; reserve half-res 2:3',
  },
  'anychess-horizontal-logo.png': {
    maxWidth: 1200,
    maxHeight: 800,
    reason: 'home header full-canvas draw ≈402×268 @1x',
  },
  'nav/home-nav.png': {
    maxWidth: 256,
    maxHeight: 384,
    reason: 'bottom-nav full-canvas draw ≈70×105 for 30px visible art',
  },
  'modes/classic.png': { maxWidth: 288, maxHeight: 288, reason: '48×48 mode list icons' },
  'modes/openings.png': { maxWidth: 288, maxHeight: 288, reason: '48×48 mode list icons' },
  'modes/blind.png': { maxWidth: 288, maxHeight: 288, reason: '48×48 mode list icons' },
  'modes/tactics.png': { maxWidth: 288, maxHeight: 288, reason: '48×48 mode list icons' },
  'modes/visualisation.png': { maxWidth: 288, maxHeight: 288, reason: '48×48 mode list icons' },
  'modes/quiz-ouverture.png': { maxWidth: 288, maxHeight: 288, reason: '48×48 mode list icons' },
  'mascots/mascot-classic-knight-soundwave.png': {
    maxWidth: 864,
    maxHeight: 1296,
    reason: 'ModeCard full-canvas ≈276×414 @1x; keep detail',
  },
  'mascots/mascot-openings-knight-reading.png': {
    maxWidth: 864,
    maxHeight: 1296,
    reason: 'ModeCard full-canvas ≈276×414 @1x; keep detail',
  },
  'mascots/mascot-blind-knight-blindfold.png': {
    maxWidth: 864,
    maxHeight: 1296,
    reason: 'ModeCard full-canvas ≈276×414 @1x; keep detail',
  },
  'mascots/mascot-tactics-knight-calculator.png': {
    maxWidth: 864,
    maxHeight: 1296,
    reason: 'ModeCard full-canvas ≈276×414 @1x; keep detail',
  },
  'mascots/mascot-visualisation-knight-binoculars.png': {
    maxWidth: 864,
    maxHeight: 1296,
    reason: 'ModeCard full-canvas ≈276×414 @1x; keep detail',
  },
  'mascots/mascot-quiz-knight-detective.png': {
    maxWidth: 864,
    maxHeight: 1296,
    reason: 'ModeCard full-canvas ≈276×414 @1x; keep detail',
  },
  'sides/white.png': { maxWidth: 216, maxHeight: 216, reason: '48×48 side pills' },
  'sides/black.png': { maxWidth: 216, maxHeight: 216, reason: '48×48 side pills' },
  'toggles/board-on.png': { maxWidth: 256, maxHeight: 256, reason: '30–72px toggle glyphs' },
  'toggles/board-off.png': { maxWidth: 256, maxHeight: 256, reason: '30–72px toggle glyphs' },
  'toggles/mic-on.png': { maxWidth: 256, maxHeight: 256, reason: '30–72px toggle glyphs' },
  'toggles/mic-off.png': { maxWidth: 256, maxHeight: 256, reason: '30–72px toggle glyphs' },
  'toggles/coords-on.png': { maxWidth: 256, maxHeight: 256, reason: '30–72px toggle glyphs' },
  'toggles/coords-off.png': { maxWidth: 256, maxHeight: 256, reason: '30–72px toggle glyphs' },
  'toggles/sound-on.png': { maxWidth: 256, maxHeight: 256, reason: 'BrandAssets reserve' },
  'toggles/sound-off.png': { maxWidth: 256, maxHeight: 256, reason: 'BrandAssets reserve' },
};

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

async function inspect(filePath) {
  const stat = fs.statSync(filePath);
  const meta = await sharp(filePath).metadata();
  return {
    bytes: stat.size,
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    hasAlpha: Boolean(meta.hasAlpha),
  };
}

async function writeLosslessPng(pipeline, outputPath, { hasAlpha }) {
  let p = pipeline;
  if (hasAlpha) p = p.ensureAlpha();
  await p
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
      effort: 10,
      palette: false,
    })
    .toFile(outputPath);
}

function needsResize(width, height, target) {
  if (!target) return false;
  return width > target.maxWidth || height > target.maxHeight;
}

async function processAsset(rel) {
  const filePath = path.join(brandRoot, rel);
  if (!fs.existsSync(filePath)) {
    throw new Error(`MISSING: ${rel}`);
  }

  const before = await inspect(filePath);
  const target = RESIZE_TARGETS[rel];
  const willResize = doResize && needsResize(before.width, before.height, target);

  const tmpPath = `${filePath}.opt.tmp.png`;
  let pipeline = sharp(filePath);

  if (willResize) {
    pipeline = pipeline.resize({
      width: target.maxWidth,
      height: target.maxHeight,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  await writeLosslessPng(pipeline, tmpPath, { hasAlpha: before.hasAlpha });
  const afterStat = fs.statSync(tmpPath);
  const afterMeta = await sharp(tmpPath).metadata();

  const dimOk =
    willResize
      ? afterMeta.width <= before.width &&
        afterMeta.height <= before.height &&
        afterMeta.width <= target.maxWidth &&
        afterMeta.height <= target.maxHeight
      : afterMeta.width === before.width && afterMeta.height === before.height;

  const aspectBefore = before.width / before.height;
  const aspectAfter = (afterMeta.width ?? 1) / (afterMeta.height ?? 1);
  const aspectOk = Math.abs(aspectBefore - aspectAfter) < 0.01;

  const alphaOk = before.hasAlpha === false ? true : Boolean(afterMeta.hasAlpha);
  const smaller = afterStat.size < before.bytes;
  const dimsChanged =
    afterMeta.width !== before.width || afterMeta.height !== before.height;

  let action = 'kept-original';
  let finalBytes = before.bytes;
  let finalW = before.width;
  let finalH = before.height;

  const reject = !dimOk || !aspectOk || !alphaOk;
  if (reject) {
    action = !dimOk
      ? 'rejected-dimension'
      : !aspectOk
        ? 'rejected-aspect'
        : 'rejected-alpha';
    fs.unlinkSync(tmpPath);
  } else if (dryRun) {
    fs.unlinkSync(tmpPath);
    finalBytes = afterStat.size;
    finalW = afterMeta.width ?? before.width;
    finalH = afterMeta.height ?? before.height;
    if (willResize && dimsChanged) action = 'would-resize';
    else if (smaller) action = 'would-optimize';
    else action = 'unchanged-size';
  } else if (willResize && dimsChanged) {
    // Always accept resize when dimensions drop (even if rare size regress).
    fs.renameSync(tmpPath, filePath);
    action = 'resized';
    finalBytes = afterStat.size;
    finalW = afterMeta.width ?? before.width;
    finalH = afterMeta.height ?? before.height;
  } else if (smaller) {
    fs.renameSync(tmpPath, filePath);
    action = 'optimized';
    finalBytes = afterStat.size;
    finalW = afterMeta.width ?? before.width;
    finalH = afterMeta.height ?? before.height;
  } else {
    fs.unlinkSync(tmpPath);
    action = doResize && !target ? 'skipped-no-target' : 'unchanged-size';
  }

  const saved = before.bytes - finalBytes;
  const pct = before.bytes ? (saved / before.bytes) * 100 : 0;

  return {
    file: rel,
    beforeWidth: before.width,
    beforeHeight: before.height,
    afterWidth: finalW,
    afterHeight: finalH,
    hasAlpha: before.hasAlpha,
    beforeBytes: before.bytes,
    afterBytes: finalBytes,
    savedBytes: saved,
    savedPct: Number(pct.toFixed(1)),
    action,
    target: target ?? null,
    reason: target?.reason ?? (doResize ? 'already within target / no target' : 'optimize only'),
  };
}

async function main() {
  if (optimizeOnly && doResize) {
    console.error('Use either --resize or --optimize-only, not both.');
    process.exit(1);
  }

  const rows = [];
  let beforeTotal = 0;
  let afterTotal = 0;

  console.log(`Brand root: ${brandRoot}`);
  console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'WRITE'} | stage: ${doResize ? 'RESIZE+PNG' : 'PNG-ONLY'}`);
  console.log(`Assets: ${ACTIVE_BRAND_ASSETS.length}`);
  console.log('');

  for (const rel of ACTIVE_BRAND_ASSETS) {
    try {
      const row = await processAsset(rel);
      rows.push(row);
      beforeTotal += row.beforeBytes;
      afterTotal += row.afterBytes;
      console.log(
        `${rel}\n` +
          `  ${row.beforeWidth}×${row.beforeHeight} → ${row.afterWidth}×${row.afterHeight}` +
          (row.target ? `  (max ${row.target.maxWidth}×${row.target.maxHeight})` : '') +
          `\n` +
          `  ${formatBytes(row.beforeBytes)} → ${formatBytes(row.afterBytes)}  ` +
          `(${row.savedPct >= 0 ? '-' : '+'}${Math.abs(row.savedPct).toFixed(1)}%)  [${row.action}]\n` +
          `  ${row.reason}`,
      );
    } catch (err) {
      console.error(`FAILED ${rel}:`, err);
      process.exitCode = 1;
    }
  }

  console.log('\n=== TOTAL ===');
  console.log(
    `${formatBytes(beforeTotal)} → ${formatBytes(afterTotal)}  ` +
      `(-${(((beforeTotal - afterTotal) / beforeTotal) * 100 || 0).toFixed(1)}%)`,
  );

  const unchanged = rows.filter((r) =>
    ['unchanged-size', 'skipped-no-target'].includes(r.action),
  );
  const resized = rows.filter((r) => r.action === 'resized' || r.action === 'would-resize');

  console.log('\n=== RESIZED ===');
  if (resized.length === 0) console.log('(none)');
  else for (const r of resized) {
    console.log(
      `${r.file}: ${r.beforeWidth}×${r.beforeHeight} → ${r.afterWidth}×${r.afterHeight} ` +
        `(${formatBytes(r.beforeBytes)} → ${formatBytes(r.afterBytes)}, -${r.savedPct}%)`,
    );
  }

  console.log('\n=== UNCHANGED ===');
  if (unchanged.length === 0) console.log('(none)');
  else for (const r of unchanged) {
    console.log(`${r.file}: ${r.beforeWidth}×${r.beforeHeight} — ${r.reason}`);
  }

  const reportPath = path.join(
    __dirname,
    doResize ? 'optimize-brand-assets.resize-report.json' : 'optimize-brand-assets.report.json',
  );
  if (!dryRun) {
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          stage: doResize ? 'resize' : 'optimize',
          beforeTotal,
          afterTotal,
          rows,
        },
        null,
        2,
      ),
    );
    console.log(`\nWrote ${reportPath}`);
  }
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
