/**
 * Generate crisp favicons from the pomegranate bottle side view.
 * Run: node scripts/generate-favicon.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..', 'public', 'images');
const SOURCE = path.join(ROOT, 'flavors', 'pomegranate.png');
const OUT = ROOT;
const BG = { r: 10, g: 9, b: 8, alpha: 1 };

async function loadBottle() {
  return sharp(SOURCE).trim({ threshold: 10 }).png().toBuffer();
}

async function buildIcon(size, paddingRatio = 0.94) {
  const bottle = await loadBottle();
  const inner = Math.max(1, Math.round(size * paddingRatio));
  const resized = await sharp(bottle)
    .resize({
      width: inner,
      height: inner,
      fit: 'inside',
    })
    .png()
    .toBuffer();

  const resizedMeta = await sharp(resized).metadata();
  const left = Math.round((size - resizedMeta.width) / 2);
  const top = Math.round((size - resizedMeta.height) / 2);

  return sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: resized, left, top }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error('Missing source:', SOURCE);
    process.exit(1);
  }

  const outputs = [
    ['favicon-32.png', 32],
    ['favicon-192.png', 192],
    ['apple-touch-icon.png', 180],
  ];

  for (const [name, size] of outputs) {
    const buf = await buildIcon(size);
    const outPath = path.join(OUT, name);
    await fs.promises.writeFile(outPath, buf);
    console.log('saved', name, size + 'x' + size);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
