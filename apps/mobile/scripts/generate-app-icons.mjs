// Rasterizes the product logo into the PNGs Expo needs, so the store icon is
// Toastie's mark rather than the Expo template's.
// Re-run whenever the logo changes: `node scripts/generate-app-icons.mjs`
// from apps/mobile.
//
// The source is apps/web/assets/toastie.svg — the same file
// apps/web/scripts/generate-pwa-icons.mjs rasterizes for the web manifest.
// The two scripts are deliberately parallel and share a background colour, so
// someone who installs both the PWA and the native app sees one icon.
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const logo = path.resolve(root, '..', 'web', 'assets', 'toastie.svg');
const images = path.join(root, 'assets', 'images');

/** Matches `colorBgLayout` in the web app's antd config — see the note in
 * generate-pwa-icons.mjs. */
const BG = '#fafafa';

/** Android crops an adaptive icon's foreground to a circle (and to other OEM
 * shapes), keeping roughly the middle two thirds. Rendering the logo at 60% of
 * the canvas keeps the whole mark inside that safe zone on every device. */
const SAFE_ZONE_SCALE = 0.6;

async function renderLogo(size, scale) {
  const inner = Math.round(size * scale);
  return sharp(logo, { density: 512 })
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
}

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

/** Logo centred on a canvas. `background` of `TRANSPARENT` gives an
 * adaptive-icon layer; an opaque colour gives a store icon. */
async function icon(size, outFile, { scale = 1, background = BG, silhouette = false } = {}) {
  const canvas = sharp({ create: { width: size, height: size, channels: 4, background } });

  if (scale > 0) {
    let mark = sharp(await renderLogo(size, scale));
    // A monochrome layer is a shape, not a picture: the launcher tints it with
    // the user's theme colour. `linear(0, 0)` zeroes every colour channel and
    // leaves alpha alone, which is exactly a black silhouette of the mark.
    if (silhouette) mark = mark.linear(0, 0);
    canvas.composite([{ input: await mark.png().toBuffer(), gravity: 'center' }]);
  }

  await canvas.png().toFile(outFile);
}

async function main() {
  await mkdir(images, { recursive: true });

  // Store and iOS icon: no transparency allowed and no rounding of our own,
  // since both stores apply their own mask.
  await icon(1024, path.join(images, 'icon.png'));

  // Android adaptive icon. Only the two mark-bearing layers are files — the
  // background is a flat colour set as `adaptiveIcon.backgroundColor` in
  // app.json, which is one fewer asset to keep in sync with this script.
  await icon(512, path.join(images, 'android-icon-foreground.png'), {
    scale: SAFE_ZONE_SCALE,
    background: TRANSPARENT,
  });
  await icon(512, path.join(images, 'android-icon-monochrome.png'), {
    scale: SAFE_ZONE_SCALE,
    background: TRANSPARENT,
    silhouette: true,
  });

  // Splash: drawn over the background colour set in app.json, so it needs
  // transparency rather than a baked-in backdrop.
  await icon(512, path.join(images, 'splash-icon.png'), { background: TRANSPARENT });

  await icon(48, path.join(images, 'favicon.png'));

  console.log('Generated app icons in assets/images/');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
