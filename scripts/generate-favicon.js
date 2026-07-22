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

async function buildIcon(size, cropTopRatio, cropHeightRatio, widthRatio = 0.88) {
  const meta = await sharp(SOURCE).metadata();
  const cropTop = Math.round(meta.height * cropTopRatio);
  const cropHeight = Math.round(meta.height * cropHeightRatio);

  const cropped = await sharp(SOURCE)
    .extract({ left: 0, top: cropTop, width: meta.width, height: cropHeight })
    .png()
    .toBuffer();

  const targetWidth = Math.max(1, Math.round(size * widthRatio));
  const resized = await sharp(cropped).resize({ width: targetWidth }).png().toBuffer();
  const resizedMeta = await sharp(resized).metadata();

  let content = resized;
  let top = Math.round((size - resizedMeta.height) / 2);
  if (resizedMeta.height > size) {
    const trimTop = Math.round((resizedMeta.height - size) / 2);
    content = await sharp(resized)
      .extract({ left: 0, top: trimTop, width: resizedMeta.width, height: size })
      .png()
      .toBuffer();
    top = 0;
  }

  const contentMeta = await sharp(content).metadata();
  const left = Math.round((size - contentMeta.width) / 2);

  return sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: content, left, top }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error('Missing source:', SOURCE);
    process.exit(1);
  }

  const outputs = [
    ['favicon-32.png', 32, 0.04, 0.42, 0.9],
    ['favicon-192.png', 192, 0.02, 0.58, 0.86],
    ['apple-touch-icon.png', 180, 0.02, 0.58, 0.86],
  ];

  for (const [name, size, top, height, widthRatio] of outputs) {
    const buf = await buildIcon(size, top, height, widthRatio);
    const outPath = path.join(OUT, name);
    await fs.promises.writeFile(outPath, buf);
    console.log('saved', name, size + 'x' + size);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
