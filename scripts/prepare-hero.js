const fs = require('fs');
const path = require('path');
const { Jimp } = require('jimp');

const SOURCE = path.join(__dirname, '../public/images/hero-bottles-source.png');
const OUTPUT = path.join(__dirname, '../public/images/hero-bottles.png');
const OUTPUT_2X = path.join(__dirname, '../public/images/hero-bottles@2x.png');

function isBlackBg(r, g, b) {
  return r <= 35 && g <= 35 && b <= 35;
}

function idx(data, w, x, y) {
  return (y * w + x) * 4;
}

function pos(w, x, y) {
  return y * w + x;
}

function floodRemoveBlack(data, w, h) {
  const visited = new Uint8Array(w * h);
  const queue = [];

  const trySeed = (x, y) => {
    const p = pos(w, x, y);
    if (visited[p]) return;
    const i = idx(data, w, x, y);
    if (isBlackBg(data[i], data[i + 1], data[i + 2])) {
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
      if (isBlackBg(data[i], data[i + 1], data[i + 2])) {
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

  return visited;
}

function softenEdges(data, w, h, visited) {
  for (let pass = 0; pass < 2; pass++) {
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

        if (r <= 55 && g <= 55 && b <= 55) {
          const lum = Math.max(r, g, b);
          data[i + 3] = Math.max(0, Math.min(255, lum * 5));
        }
      }
    }
  }
}

async function prepareTransparentHero() {
  const img = await Jimp.read(SOURCE);
  const w = img.bitmap.width;
  const h = img.bitmap.height;
  const data = img.bitmap.data;

  const visited = floodRemoveBlack(data, w, h);
  softenEdges(data, w, h, visited);

  img
    .normalize()
    .contrast(0.06)
    .convolute([
      [0, -0.12, 0],
      [-0.12, 1.48, -0.12],
      [0, -0.12, 0],
    ]);

  await img.write(OUTPUT);
  console.log('Saved:', OUTPUT, `${w}x${h}`);

  const img2x = img.clone().scale(2, Jimp.RESIZE_BICUBIC);
  await img2x.write(OUTPUT_2X);
  console.log('Saved:', OUTPUT_2X, `${img2x.bitmap.width}x${img2x.bitmap.height}`);
}

prepareTransparentHero().catch((err) => {
  console.error(err);
  process.exit(1);
});
