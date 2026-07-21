/**
 * Removes light/white fringe from shipping-box-empty.png.
 * Run: node scripts/process-box-image.js
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const input = path.join(__dirname, '..', 'public', 'images', 'shipping-box-empty.png');
const output = input;

function defringe(data, width, height) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (width * y + x) << 2;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a === 0) continue;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const spread = max - min;

      // Pure/near-white fringe from bad cutout
      if (max > 210 && spread < 40) {
        const t = Math.min(1, (max - 200) / 55);
        data[i + 3] = Math.round(a * (1 - t));
        continue;
      }

      // Light grey halos around cardboard edges
      if (max > 175 && spread < 35 && r > 160 && g > 150 && b > 140) {
        const t = Math.min(1, (max - 165) / 90);
        data[i + 3] = Math.round(a * (1 - t * 0.85));
      }
    }
  }

  // Second pass: soften pixels bordering transparency (edge halos)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (width * y + x) << 2;
      if (data[i + 3] < 20) continue;

      let nearTransparent = false;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
            nearTransparent = true;
            break;
          }
          if (data[((width * ny + nx) << 2) + 3] < 20) {
            nearTransparent = true;
            break;
          }
        }
        if (nearTransparent) break;
      }

      if (!nearTransparent) continue;

      const max = Math.max(data[i], data[i + 1], data[i + 2]);
      if (max > 120) {
        const t = Math.min(1, (max - 100) / 130);
        data[i + 3] = Math.round(data[i + 3] * (1 - t * 0.95));
      }
    }
  }
}

function trim(data, width, height) {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[((width * y + x) << 2) + 3];
      if (a > 20) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX <= minX) return { data, width, height };

  const pad = 2;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);

  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const out = Buffer.alloc(w * h * 4);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const src = ((width * (minY + y) + (minX + x)) << 2);
      const dst = ((w * y + x) << 2);
      out[dst] = data[src];
      out[dst + 1] = data[src + 1];
      out[dst + 2] = data[src + 2];
      out[dst + 3] = data[src + 3];
    }
  }

  return { data: out, width: w, height: h };
}

async function main() {
  const png = PNG.sync.read(fs.readFileSync(input));
  defringe(png.data, png.width, png.height);
  fs.writeFileSync(output, PNG.sync.write(png));
  console.log('Saved', output, `${png.width}x${png.height}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
