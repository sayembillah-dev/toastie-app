// Rasterizes assets/toastie.svg into the PNGs the web manifest and the
// apple-icon file convention need. Re-run this whenever the logo changes —
// `node scripts/generate-pwa-icons.mjs` from apps/web.
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const logo = path.join(root, 'assets', 'toastie.svg');

// Matches the antd `ConfigProvider` background token (`colorBgLayout`) in
// antd-provider.tsx / `--color-sidebar` in globals.css, so the padded icon
// canvas reads as the same surface as the app chrome.
const BG = '#fafafa';

async function squareIcon(size, { padded = false, outFile }) {
  const inner = padded ? Math.round(size * 0.6) : size;
  const logoBuffer = await sharp(logo, { density: 384 })
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: logoBuffer, gravity: 'center' }])
    .png()
    .toFile(outFile);
}

async function main() {
  const iconsDir = path.join(root, 'public', 'icons');
  await mkdir(iconsDir, { recursive: true });

  await squareIcon(192, { outFile: path.join(iconsDir, 'icon-192.png') });
  await squareIcon(512, { outFile: path.join(iconsDir, 'icon-512.png') });
  // Maskable icons get cropped to a circle by the OS on Android — the 60%
  // inner scale keeps the bird inside that "safe zone".
  await squareIcon(512, { padded: true, outFile: path.join(iconsDir, 'icon-maskable-512.png') });

  // Next's `apple-icon.png` file convention — must live inside `src/app/`.
  await squareIcon(180, {
    padded: true,
    outFile: path.join(root, 'src', 'app', 'apple-icon.png'),
  });

  console.log('Generated PWA icons in public/icons/ and src/app/apple-icon.png');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
