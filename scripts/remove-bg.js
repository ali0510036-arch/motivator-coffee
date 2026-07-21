const fs = require('fs');
const path = require('path');
const { Jimp } = require('jimp');

const INPUT = path.join(__dirname, '../public/images/hero-bottles.png');
const BACKUP = path.join(__dirname, '../public/images/hero-bottles-source.png');

function isBackground(r, g, b) {
  const light = r >= 232 && g >= 232 && b >= 232;
  const dark = r <= 28 && g <= 28 && b <= 28;
  return light || dark;
}

function idx(data, w, x, y) {
  return (y * w + x) * 4;
}

function pos(w, x, y) {
  return y * w + x;
}

async function removeBackground() {
  if (!fs.existsSync(BACKUP)) {
    fs.copyFileSync(INPUT, BACKUP);
    console.log('Backup:', BACKUP);
  }

  const img = await Jimp.read(INPUT);
  const w = img.bitmap.width;
  const h = img.bitmap.height;
  const data = img.bitmap.data;
  const visited = new Uint8Array(w * h);
  const queue = [];

  const trySeed = (x, y) => {
    const p = pos(w, x, y);
    if (visited[p]) return;
    const i = idx(data, w, x, y);
    if (isBackground(data[i], data[i + 1], data[i + 2])) {
      visited[p] = 1;
      queue.push([x, y]);
    }
  };

  for (let x = 0; x < w; x++) {
    trySeed(x, 0);
    trySeed(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    trySeed(0, y);
    trySeed(w - 1, y);
  }

  while (queue.length) {
    const [x, y] = queue.pop();
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const p = pos(w, nx, ny);
      if (visited[p]) continue;
      const i = idx(data, w, nx, ny);
      if (isBackground(data[i], data[i + 1], data[i + 2])) {
        visited[p] = 1;
        queue.push([nx, ny]);
      }
    }
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!visited[pos(w, x, y)]) continue;
      data[idx(data, w, x, y) + 3] = 0;
    }
  }

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = pos(w, x, y);
      if (visited[p]) continue;
      const i = idx(data, w, x, y);
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      let nearBg = false;
      for (const [nx, ny] of [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ]) {
        if (visited[pos(w, nx, ny)]) {
          nearBg = true;
          break;
        }
      }
      if (!nearBg) continue;

      if (r >= 210 && g >= 210 && b >= 210) {
        const edge = Math.min(r, g, b);
        data[i + 3] = Math.max(0, Math.min(255, (edge - 205) * 10));
      } else if (r <= 40 && g <= 40 && b <= 40) {
        const edge = Math.max(r, g, b);
        data[i + 3] = Math.max(0, Math.min(255, edge * 6));
      }
    }
  }

  await img.write(INPUT);
  console.log('Saved transparent PNG:', INPUT, `${w}x${h}`);
}

removeBackground().catch((err) => {
  console.error(err);
  process.exit(1);
});
