/**
 * Detect inner bottle grid on shipping-box-empty.png
 * Run: node scripts/calibrate-box-grid.js
 */
const path = require('path');
const { Jimp } = require('jimp');

const EMPTY = path.join(__dirname, '..', 'public', 'images', 'shipping-box-empty.png');

function lum(data, w, x, y) {
  const i = (w * y + x) << 2;
  return (data[i] + data[i + 1] + data[i + 2]) / 3;
}

function isDivider(data, w, x, y) {
  const i = (w * y + x) << 2;
  if (data[i + 3] < 20) return false;
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  return r < 95 && g < 75 && b < 60;
}

async function main() {
  const img = await Jimp.read(EMPTY);
  const w = img.bitmap.width;
  const h = img.bitmap.height;
  const d = img.bitmap.data;

  const cy = Math.round(h * 0.48);
  const cx = Math.round(w * 0.5);

  const xs = [];
  for (let x = 2; x < w - 2; x++) {
    if (isDivider(d, w, x, cy)) xs.push(x);
  }
  const ys = [];
  for (let y = 2; y < h - 2; y++) {
    if (isDivider(d, w, cx, y)) ys.push(y);
  }

  function clusters(arr) {
    const out = [];
    let c = [arr[0]];
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] - arr[i - 1] <= 4) c.push(arr[i]);
      else {
        out.push(Math.round(c.reduce((a, b) => a + b, 0) / c.length));
        c = [arr[i]];
      }
    }
    if (c.length) out.push(Math.round(c.reduce((a, b) => a + b, 0) / c.length));
    return out;
  }

  const cols = clusters(xs).filter((x) => x > 200 && x < w - 200);
  const rows = clusters(ys).filter((y) => y > 150 && y < h - 100);

  const left = cols[0] - Math.round((cols[1] - cols[0]) / 2);
  const right = cols[cols.length - 1] + Math.round((cols[cols.length - 1] - cols[cols.length - 2]) / 2);
  const top = rows[0] - Math.round((rows[1] - rows[0]) / 2);
  const bottom = rows[rows.length - 1] + Math.round((rows[rows.length - 1] - rows[rows.length - 2]) / 2);

  console.log(JSON.stringify({
    px: { left, top, right, bottom, w: right - left, h: bottom - top },
    pct: {
      x: +(left / w * 100).toFixed(2),
      y: +(top / h * 100).toFixed(2),
      w: +((right - left) / w * 100).toFixed(2),
      h: +((bottom - top) / h * 100).toFixed(2),
    },
    cols,
    rows,
  }, null, 2));
}

main().catch(console.error);
