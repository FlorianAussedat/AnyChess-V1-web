/**
 * Build lightweight display copies of the user-supplied v1 brand PNGs.
 *
 * Originals under assets/brand/{mascots,nav,...} are NEVER modified.
 * Output goes to assets/brand/display/** as WebP (~512px long edge).
 *
 * Usage (from artifacts/mobile):
 *   node scripts/optimize-brand-display-assets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BRAND = path.join(ROOT, 'assets', 'brand');
const OUT = path.join(BRAND, 'display');

/** Long-edge px — enough for @2x/@3x at home logo (~220px) and ModeCard art. */
const LONG_EDGE = 512;
const WEBP_QUALITY = 82;

/** Source paths relative to assets/brand (exact on-disk names). */
const SOURCES = [
  'v1-anychess-horizontal-logo.png',
  'nav/v1-home-nav.png',
  'mascots/V1-mascot-classic-knight-soundwave.png',
  'mascots/V1-mascot-openings-knight-reading.png.png',
  'mascots/v1-mascot-blind-knight-blindfold.png',
  'mascots/v1-mascot-tactics-knight-calculator.png',
  'mascots/v1-mascot-visualisation-knight-binoculars.png',
  'mascots/V1-mascot-quiz-knight-detective.png',
];

function outPathFor(rel) {
  const parsed = path.parse(rel);
  // Collapse double .png.png → single stem + .webp
  let name = parsed.name;
  if (name.toLowerCase().endsWith('.png')) {
    name = name.slice(0, -4);
  }
  return path.join(OUT, parsed.dir, `${name}.webp`);
}

async function optimizeOne(rel) {
  const src = path.join(BRAND, rel);
  if (!fs.existsSync(src)) {
    throw new Error(`Missing source: ${src}`);
  }
  const dest = outPathFor(rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  const meta = await sharp(src).metadata();
  const w = meta.width ?? LONG_EDGE;
  const h = meta.height ?? LONG_EDGE;
  const scale = LONG_EDGE / Math.max(w, h);
  const tw = Math.max(1, Math.round(w * Math.min(1, scale)));
  const th = Math.max(1, Math.round(h * Math.min(1, scale)));

  await sharp(src)
    .resize(tw, th, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY, alphaQuality: 90, effort: 5 })
    .toFile(dest);

  const before = fs.statSync(src).size;
  const after = fs.statSync(dest).size;
  const pct = ((1 - after / before) * 100).toFixed(1);
  console.log(
    `${rel}  ${(before / 1024).toFixed(0)}KB → ${(after / 1024).toFixed(0)}KB  (-${pct}%)  ${tw}×${th}`,
  );
  return { before, after };
}

async function main() {
  let before = 0;
  let after = 0;
  for (const rel of SOURCES) {
    const r = await optimizeOne(rel);
    before += r.before;
    after += r.after;
  }
  console.log(
    `\nTotal home brand: ${(before / 1024 / 1024).toFixed(2)}MB → ${(after / 1024 / 1024).toFixed(2)}MB`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
