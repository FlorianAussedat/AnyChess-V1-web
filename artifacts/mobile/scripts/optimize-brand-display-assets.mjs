/**
 * Build lightweight display copies of the user-supplied v1 brand PNGs.
 *
 * Originals under assets/brand/{mascots,nav,modes,...} are NEVER modified.
 * Output goes to assets/brand/display/** as WebP.
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
const HOME_LONG_EDGE = 512;
/** HubModeCard icons render at 40×40 — 192px covers @3x with headroom. */
const EXERCISE_LONG_EDGE = 192;
const WEBP_QUALITY = 82;

/** Source paths relative to assets/brand (exact on-disk names). */
const HOME_SOURCES = [
  'v1-anychess-horizontal-logo.png',
  'nav/v1-home-nav.png',
  'mascots/V1-mascot-classic-knight-soundwave.png',
  'mascots/V1-mascot-openings-knight-reading.png.png',
  'mascots/v1-mascot-blind-knight-blindfold.png',
  'mascots/v1-mascot-tactics-knight-calculator.png',
  'mascots/v1-mascot-visualisation-knight-binoculars.png',
  'mascots/V1-mascot-quiz-knight-detective.png',
  'mascots/mascot-player-knight-dj.png',
];

/**
 * Exercise HubModeCard mascots — originals stay in modes/; display copies use
 * ASCII kebab WebP names (Metro-friendly, no spaces / curly apostrophes).
 */
const EXERCISE_SOURCES = [
  { src: 'modes/Construis l’ouverture.png', out: 'modes/construis-ouverture.webp' },
  { src: 'modes/Ecouter puis reconstruire.png', out: 'modes/ecouter-puis-reconstruire.webp' },
  { src: 'modes/Problemes Visuels.png', out: 'modes/problemes-visuels.webp' },
  { src: 'modes/Quiz.png', out: 'modes/quiz.webp' },
  { src: 'modes/Suivi mental de position.png', out: 'modes/suivi-mental-de-position.webp' },
  { src: 'modes/Jouer le coup.png', out: 'modes/jouer-le-coup.webp' },
  { src: 'modes/Regarder puis réciter.png', out: 'modes/regarder-puis-reciter.webp' },
  { src: "modes/Problemes a l'aveugle.png", out: 'modes/problemes-a-l-aveugle.webp' },
  { src: 'modes/Nommer le coup.png', out: 'modes/nommer-le-coup.webp' },
  { src: 'modes/Quelle ouverture.png', out: 'modes/quelle-ouverture.webp' },
];

function homeOutPathFor(rel) {
  const parsed = path.parse(rel);
  // Collapse double .png.png → single stem + .webp
  let name = parsed.name;
  if (name.toLowerCase().endsWith('.png')) {
    name = name.slice(0, -4);
  }
  return path.join(OUT, parsed.dir, `${name}.webp`);
}

async function writeWebp(srcAbs, destAbs, longEdge) {
  fs.mkdirSync(path.dirname(destAbs), { recursive: true });

  const meta = await sharp(srcAbs).metadata();
  const w = meta.width ?? longEdge;
  const h = meta.height ?? longEdge;
  const scale = longEdge / Math.max(w, h);
  const tw = Math.max(1, Math.round(w * Math.min(1, scale)));
  const th = Math.max(1, Math.round(h * Math.min(1, scale)));

  await sharp(srcAbs)
    .resize(tw, th, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY, alphaQuality: 90, effort: 5 })
    .toFile(destAbs);

  const before = fs.statSync(srcAbs).size;
  const after = fs.statSync(destAbs).size;
  const pct = ((1 - after / before) * 100).toFixed(1);
  console.log(
    `${path.relative(BRAND, srcAbs)}  ${(before / 1024).toFixed(0)}KB → ${(after / 1024).toFixed(0)}KB  (-${pct}%)  ${tw}×${th}`,
  );
  return { before, after };
}

async function optimizeHome(rel) {
  const src = path.join(BRAND, rel);
  if (!fs.existsSync(src)) {
    throw new Error(`Missing source: ${src}`);
  }
  return writeWebp(src, homeOutPathFor(rel), HOME_LONG_EDGE);
}

async function optimizeExercise({ src, out }) {
  const srcAbs = path.join(BRAND, src);
  if (!fs.existsSync(srcAbs)) {
    throw new Error(`Missing source: ${srcAbs}`);
  }
  return writeWebp(srcAbs, path.join(OUT, out), EXERCISE_LONG_EDGE);
}

async function main() {
  let before = 0;
  let after = 0;

  console.log('— Home brand —');
  for (const rel of HOME_SOURCES) {
    try {
      const r = await optimizeHome(rel);
      before += r.before;
      after += r.after;
    } catch (err) {
      // Home v1 sources may be absent in some checkouts; skip with warning.
      console.warn(`skip home: ${rel} (${err.message})`);
    }
  }

  console.log('\n— Exercise hub mascots —');
  let exBefore = 0;
  let exAfter = 0;
  for (const entry of EXERCISE_SOURCES) {
    const r = await optimizeExercise(entry);
    exBefore += r.before;
    exAfter += r.after;
  }

  console.log(
    `\nHome brand: ${(before / 1024 / 1024).toFixed(2)}MB → ${(after / 1024 / 1024).toFixed(2)}MB`,
  );
  console.log(
    `Exercise hubs: ${(exBefore / 1024 / 1024).toFixed(2)}MB → ${(exAfter / 1024 / 1024).toFixed(2)}MB`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
