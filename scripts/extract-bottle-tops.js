/**
 * Extract top-view bottle PNGs from shipping-box.png
 * Run: node scripts/extract-bottle-tops.js
 */
const fs = require('fs');
const path = require('path');
const { Jimp } = require('jimp');

const ROOT = path.join(__dirname, '..', 'public', 'images');
const BOX = path.join(ROOT, 'shipping-box.png');
const EMPTY = path.join(ROOT, 'shipping-box-empty.png');
const EMPTY_SRC = path.join(ROOT, 'shipping-box-empty-src.png');
const OUT_DIR = path.join(ROOT, 'flavors', 'top');

// Which cell to sample each flavor from (col, row) in the 4×3 grid
const FLAVOR_CELLS = {
  pomegranate: [0, 0],
  orange: [1, 0],
  blackcurrant: [2, 0],
  cherry: [3, 0],
  cornelian: [0, 1],
  raspberry: [2, 2],
};

function getGrid(image) {
  const w = image.bitmap.width;
  const h = image.bitmap.height;
  const left = Math.round(w * 0.109);
  const right = Math.round(w * 0.891);
  const top = Math.round(h * 0.188);
  const bottom = Math.round(h * 0.905);
  return {
    left,
    top,
    right,
    bottom,
    cellW: (right - left) / 4,
    cellH: (bottom - top) / 3,
  };
}

function innerCellRect(grid, col, row) {
  const x0 = grid.left + col * grid.cellW;
  const y0 = grid.top + row * grid.cellH;
  const padX = grid.cellW * 0.13;
  const padY = grid.cellH * 0.13;
  return {
    x: Math.round(x0 + padX),
    y: Math.round(y0 + padY),
    w: Math.round(grid.cellW - padX * 2),
    h: Math.round(grid.cellH - padY * 2),
  };
}

function clampRect(rect, image) {
  const maxW = image.bitmap.width;
  const maxH = image.bitmap.height;
  const x = Math.max(0, Math.min(rect.x, maxW - 1));
  const y = Math.max(0, Math.min(rect.y, maxH - 1));
  const w = Math.max(1, Math.min(rect.w, maxW - x));
  const h = Math.max(1, Math.min(rect.h, maxH - y));
  return { x, y, w, h };
}

function toSquare(image, size) {
  const side = Math.max(image.bitmap.width, image.bitmap.height);
  const canvas = new Jimp({ width: side, height: side, color: 0x00000000 });
  const x = Math.round((side - image.bitmap.width) / 2);
  const y = Math.round((side - image.bitmap.height) / 2);
  canvas.composite(image, x, y);
  return canvas.resize({ w: size, h: size });
}

function applySoftCircle(image) {
  const w = image.bitmap.width;
  const h = image.bitmap.height;
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) * 0.47;

  image.scan(0, 0, w, h, function (x, y, idx) {
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist >= radius) {
      this.bitmap.data[idx + 3] = 0;
    } else if (dist > radius * 0.88) {
      const t = (dist - radius * 0.88) / (radius * 0.12);
      this.bitmap.data[idx + 3] = Math.round(this.bitmap.data[idx + 3] * (1 - t));
    }
  });
}

function floodRemoveBackground(image, isBg) {
  const w = image.bitmap.width;
  const h = image.bitmap.height;
  const visited = new Uint8Array(w * h);
  const queue = [];

  function push(x, y) {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (visited[p]) return;
    const idx = p << 2;
    if (!isBg(image.bitmap.data[idx], image.bitmap.data[idx + 1], image.bitmap.data[idx + 2])) return;
    visited[p] = 1;
    queue.push([x, y]);
  }

  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }

  while (queue.length) {
    const [x, y] = queue.pop();
    image.bitmap.data[((w * y + x) << 2) + 3] = 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
}

function isBoxBg(r, g, b) {
  const max = Math.max(r, g, b);
  const spread = max - Math.min(r, g, b);
  if (max < 95) return true;
  if (max > 210 && spread < 55) return true;
  return false;
}

async function extractTops() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const [id, [col, row]] of Object.entries(FLAVOR_CELLS)) {
    const box = await Jimp.read(BOX);
    const grid = getGrid(box);
    const rect = clampRect(innerCellRect(grid, col, row), box);
    let crop = box.crop(rect);
    crop = toSquare(crop, 300);
    applySoftCircle(crop);
    await crop.write(path.join(OUT_DIR, `${id}.png`));
    console.log('saved', id, rect);
  }
}

async function cleanEmptyBox() {
  const src = fs.existsSync(EMPTY_SRC) ? EMPTY_SRC : EMPTY;
  const img = await Jimp.read(src);
  floodRemoveBackground(img, isBoxBg);
  await img.write(EMPTY);
  console.log('cleaned empty box', img.bitmap.width, img.bitmap.height);
}

async function main() {
  await extractTops();
  await cleanEmptyBox();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
