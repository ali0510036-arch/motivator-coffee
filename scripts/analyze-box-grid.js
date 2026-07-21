const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const file = path.join(__dirname, '..', 'public', 'images', 'shipping-box-empty.png');
const png = PNG.sync.read(fs.readFileSync(file));
const { width, height, data } = png;

function isCardboard(x, y) {
  const i = (width * y + x) << 2;
  if (data[i + 3] < 20) return false;
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  return r > 95 && g > 58 && b > 28 && r > g && g > b;
}

function findTransitions(start, end, fixed, horizontal) {
  const edges = [];
  const len = horizontal ? width : height;
  const fixedCoord = fixed;

  for (let i = start + 1; i < end - 1; i++) {
    const a = horizontal ? isCardboard(i, fixedCoord) : isCardboard(fixedCoord, i);
    const b = horizontal ? isCardboard(i - 1, fixedCoord) : isCardboard(fixedCoord, i - 1);
    const c = horizontal ? isCardboard(i + 1, fixedCoord) : isCardboard(fixedCoord, i + 1);
    const gap = !a && (b || c);
    if (gap) edges.push(i);
  }

  const clusters = [];
  let cluster = [];
  for (const v of edges) {
    if (!cluster.length || v - cluster[cluster.length - 1] <= 4) cluster.push(v);
    else {
      clusters.push(Math.round(cluster.reduce((s, n) => s + n, 0) / cluster.length));
      cluster = [v];
    }
  }
  if (cluster.length) clusters.push(Math.round(cluster.reduce((s, n) => s + n, 0) / cluster.length));
  return clusters;
}

const x0 = 100;
const x1 = 920;
const y0 = 130;
const y1 = 710;
const cy = 420;
const cx = 512;

const cols = findTransitions(x0, x1, cy, true).filter((x) => x > 250 && x < 780);
const rows = findTransitions(y0, y1, cx, false).filter((y) => y > 250 && y < 650);

console.log('cols', cols);
console.log('rows', rows);

const left = cols.length >= 3 ? cols[0] - Math.round((cols[1] - cols[0]) / 2) : 112;
const right = cols.length >= 3 ? cols[cols.length - 1] + Math.round((cols[cols.length - 1] - cols[cols.length - 2]) / 2) : 912;
const top = rows.length >= 2 ? rows[0] - Math.round((rows[1] - rows[0]) / 2) : 145;
const bottom = rows.length >= 2 ? rows[rows.length - 1] + Math.round((rows[rows.length - 1] - rows[rows.length - 2]) / 2) : 698;

console.log('bounds', { left, top, right, bottom, w: right - left, h: bottom - top });
console.log('css', {
  x: `${(left / width * 100).toFixed(2)}%`,
  y: `${(top / height * 100).toFixed(2)}%`,
  w: `${((right - left) / width * 100).toFixed(2)}%`,
  h: `${((bottom - top) / height * 100).toFixed(2)}%`,
});

const cellW = (right - left) / 4;
const cellH = (bottom - top) / 3;
const inset = 14;
const rects = [];
for (let r = 0; r < 3; r++) {
  for (let c = 0; c < 4; c++) {
    rects.push({
      x: Math.round(left + c * cellW + inset),
      y: Math.round(top + r * cellH + inset),
      w: Math.round(cellW - inset * 2),
      h: Math.round(cellH - inset * 2),
    });
  }
}
console.log('mask rects', JSON.stringify(rects, null, 2));
