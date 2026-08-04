/**
 * Optimize active AnyChess production brand PNGs with sharp (lossless).
 *
 * Scope: only files listed in ACTIVE_BRAND_ASSETS (mirrors BrandAssets.ts).
 * - Keeps PNG format
 * - Preserves dimensions and alpha
 * - Never upsizes; never auto-resizes oversized sources (reports only)
 * - Skips write-back when optimized output is not smaller
 *
 * Usage (from artifacts/mobile):
 *   node scripts/optimize-brand-assets.mjs
 *   node scripts/optimize-brand-assets.mjs --dry-run
 *   pnpm run optimize:brand
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const brandRoot = path.resolve(__dirname, '../assets/brand');
const dryRun = process.argv.includes('--dry-run');

/**
 * Paths relative to assets/brand — keep in sync with constants/BrandAssets.ts.
 * Do not add unused / dead assets here.
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
 * Approximate on-screen max box (CSS/layout px) for oversize reporting only.
 * Values are intentional UI budgets from DesignTokens / typical phone headers —
 * NOT applied as resize targets by this script.
 */
const DISPLAY_BUDGET_PX = {
  'logo-mark.png': { w: 120, h: 120, note: 'splash / side indicator mark' },
  'splash-brand.png': { w: 320, h: 320, note: 'launch splash (if used as full art)' },
  'anychess-horizontal-logo.png': { w: 280, h: 80, note: 'home header logo viewport' },
  'nav/home-nav.png': { w: 32, h: 32, note: 'DesignTokens.bottomNavHomeIcon*' },
  'modes/classic.png': { w: 96, h: 96, note: 'mode list / quiz icons' },
  'modes/openings.png': { w: 96, h: 96, note: 'mode list / quiz icons' },
  'modes/blind.png': { w: 96, h: 96, note: 'mode list / quiz icons' },
  'modes/tactics.png': { w: 96, h: 96, note: 'mode list / quiz icons' },
  'modes/visualisation.png': { w: 96, h: 96, note: 'mode list / quiz icons' },
  'modes/quiz-ouverture.png': { w: 96, h: 96, note: 'mode list / quiz icons' },
  'modes/target.png': { w: 96, h: 96, note: 'mode list / quiz icons' },
  'mascots/mascot-classic-knight-soundwave.png': {
    w: 168,
    h: 180,
    note: 'DesignTokens.modeIllustration* (@1x box; @3x ≈ 504×540)',
  },
  'mascots/mascot-openings-knight-reading.png': {
    w: 168,
    h: 180,
    note: 'DesignTokens.modeIllustration*',
  },
  'mascots/mascot-blind-knight-blindfold.png': {
    w: 168,
    h: 180,
    note: 'DesignTokens.modeIllustration*',
  },
  'mascots/mascot-tactics-knight-calculator.png': {
    w: 168,
    h: 180,
    note: 'DesignTokens.modeIllustration*',
  },
  'mascots/mascot-visualisation-knight-binoculars.png': {
    w: 168,
    h: 180,
    note: 'DesignTokens.modeIllustration*',
  },
  'mascots/mascot-quiz-knight-detective.png': {
    w: 168,
    h: 180,
    note: 'DesignTokens.modeIllustration*',
  },
  'sides/white.png': { w: 72, h: 72, note: 'side choice chip' },
  'sides/black.png': { w: 72, h: 72, note: 'side choice chip' },
  'sides/random.png': { w: 72, h: 72, note: 'side choice chip' },
  'toggles/board-on.png': { w: 44, h: 44, note: 'toolbar toggle' },
  'toggles/board-off.png': { w: 44, h: 44, note: 'toolbar toggle' },
  'toggles/mic-on.png': { w: 44, h: 44, note: 'toolbar toggle' },
  'toggles/mic-off.png': { w: 44, h: 44, note: 'toolbar toggle' },
  'toggles/coords-on.png': { w: 44, h: 44, note: 'toolbar toggle' },
  'toggles/coords-off.png': { w: 44, h: 44, note: 'toolbar toggle' },
  'toggles/sound-on.png': { w: 44, h: 44, note: 'BrandAssets map (Ionicons used today)' },
  'toggles/sound-off.png': { w: 44, h: 44, note: 'BrandAssets map (Ionicons used today)' },
};

/** @3x retina budget multiplier for “unnecessarily huge” detection. */
const RETINA_BUDGET_MULT = 3;
/** Flag when source edge exceeds retina budget by this factor. */
const OVERSIZE_FACTOR = 1.5;

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
    channels: meta.channels,
    space: meta.space,
  };
}

/**
 * Lossless PNG rewrite: max zlib compression, preserve color model + alpha.
 * No palette quantization (avoids posterization on mascot art).
 */
async function optimizeLossless(inputPath, outputPath, { hasAlpha }) {
  let pipeline = sharp(inputPath);
  // Do not invent an alpha channel on opaque assets — only preserve existing.
  if (hasAlpha) {
    pipeline = pipeline.ensureAlpha();
  }
  await pipeline
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
      effort: 10,
      palette: false,
    })
    .toFile(outputPath);
}

function oversizeReport(rel, width, height) {
  const budget = DISPLAY_BUDGET_PX[rel];
  if (!budget || !width || !height) return null;
  const maxW = budget.w * RETINA_BUDGET_MULT;
  const maxH = budget.h * RETINA_BUDGET_MULT;
  const factorW = width / maxW;
  const factorH = height / maxH;
  const factor = Math.max(factorW, factorH);
  if (factor < OVERSIZE_FACTOR) return null;
  return {
    rel,
    width,
    height,
    displayBudgetPx: budget,
    retinaBudgetPx: { w: maxW, h: maxH },
    oversizeFactor: Number(factor.toFixed(2)),
    note: budget.note,
    recommendation:
      `Source is ~${factor.toFixed(1)}× larger than a @${RETINA_BUDGET_MULT}x ` +
      `${budget.w}×${budget.h} display budget. Consider a future resize pass ` +
      `(and brandArtBounds update if canvas fractions must stay valid). ` +
      `Not resized in this pass.`,
  };
}

async function main() {
  const rows = [];
  const oversized = [];
  let beforeTotal = 0;
  let afterTotal = 0;

  console.log(`Brand root: ${brandRoot}`);
  console.log(`Mode: ${dryRun ? 'DRY-RUN (no writes)' : 'WRITE'}`);
  console.log(`Assets: ${ACTIVE_BRAND_ASSETS.length}`);
  console.log('');

  for (const rel of ACTIVE_BRAND_ASSETS) {
    const filePath = path.join(brandRoot, rel);
    if (!fs.existsSync(filePath)) {
      console.error(`MISSING: ${rel}`);
      process.exitCode = 1;
      continue;
    }

    const before = await inspect(filePath);
    beforeTotal += before.bytes;

    const over = oversizeReport(rel, before.width, before.height);
    if (over) oversized.push(over);

    const tmpPath = `${filePath}.opt.tmp.png`;
    try {
      await optimizeLossless(filePath, tmpPath, { hasAlpha: before.hasAlpha });
      const afterStat = fs.statSync(tmpPath);
      const afterMeta = await sharp(tmpPath).metadata();

      const dimOk =
        afterMeta.width === before.width && afterMeta.height === before.height;
      const alphaOk =
        before.hasAlpha === false
          ? true
          : Boolean(afterMeta.hasAlpha);
      const smaller = afterStat.size < before.bytes;
      const same = afterStat.size === before.bytes;
      let action = 'kept-original';
      let finalBytes = before.bytes;

      if (!dimOk) {
        action = 'rejected-dimension-change';
        fs.unlinkSync(tmpPath);
      } else if (dryRun) {
        fs.unlinkSync(tmpPath);
        finalBytes = afterStat.size;
        if (smaller) action = 'would-optimize';
        else if (same) action = 'unchanged-size';
        else action = 'would-keep-original-smaller';
      } else if (smaller) {
        fs.renameSync(tmpPath, filePath);
        action = 'optimized';
        finalBytes = afterStat.size;
      } else {
        fs.unlinkSync(tmpPath);
        if (same) action = 'unchanged-size';
        else action = 'kept-original-smaller';
        finalBytes = before.bytes;
      }

      afterTotal += finalBytes;
      const saved = before.bytes - finalBytes;
      const pct = before.bytes ? (saved / before.bytes) * 100 : 0;

      const row = {
        file: rel,
        width: before.width,
        height: before.height,
        hasAlpha: before.hasAlpha,
        beforeBytes: before.bytes,
        afterBytes: finalBytes,
        savedBytes: saved,
        savedPct: Number(pct.toFixed(1)),
        action,
        dimOk,
        alphaPreserved: alphaOk,
      };
      rows.push(row);

      console.log(
        `${rel}\n` +
          `  ${before.width}×${before.height}  alpha=${before.hasAlpha}\n` +
          `  ${formatBytes(before.bytes)} → ${formatBytes(finalBytes)}  ` +
          `(${pct >= 0 ? '-' : '+'}${Math.abs(pct).toFixed(1)}%)  [${action}]`,
      );
    } catch (err) {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      console.error(`FAILED ${rel}:`, err);
      process.exitCode = 1;
      afterTotal += before.bytes;
    }
  }

  console.log('\n=== TOTAL ===');
  console.log(
    `${formatBytes(beforeTotal)} → ${formatBytes(afterTotal)}  ` +
      `(-${(((beforeTotal - afterTotal) / beforeTotal) * 100 || 0).toFixed(1)}%)`,
  );

  console.log('\n=== OVERSIZED vs UI BUDGET (report only — not resized) ===');
  if (oversized.length === 0) {
    console.log('(none)');
  } else {
    for (const o of oversized.sort((a, b) => b.oversizeFactor - a.oversizeFactor)) {
      console.log(
        `${o.rel}: ${o.width}×${o.height} vs @3x budget ${o.retinaBudgetPx.w}×${o.retinaBudgetPx.h} ` +
          `(×${o.oversizeFactor}) — ${o.note}`,
      );
      console.log(`  → ${o.recommendation}`);
    }
  }

  const reportPath = path.join(__dirname, 'optimize-brand-assets.report.json');
  if (!dryRun) {
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          beforeTotal,
          afterTotal,
          rows,
          oversized,
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
