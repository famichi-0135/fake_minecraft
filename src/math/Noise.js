import { LCG } from "./Random.js";

// Perlin Noise の置換テーブルを LCG で初期化
const rng = LCG(9999);
const P = new Uint8Array(256);
for (let i = 0; i < 256; i++) P[i] = Math.floor(rng() * 256);
const p = new Uint8Array(512);
for (let i = 0; i < 512; i++) p[i] = P[i % 256];

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(t, a, b) {
  return a + t * (b - a);
}

function grad(hash, x, y) {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

/**
 * 2D Perlin Noise
 * @param {number} x
 * @param {number} y
 * @returns {number} -1 ~ 1 の範囲のノイズ値
 */
export function noise(x, y) {
  let X = Math.floor(x) & 255;
  let Y = Math.floor(y) & 255;
  x -= Math.floor(x);
  y -= Math.floor(y);
  const u = fade(x);
  const v = fade(y);
  const a = p[X] + Y;
  const aa = p[a];
  const ab = p[a + 1];
  const b = p[X + 1] + Y;
  const ba = p[b];
  const bb = p[b + 1];
  return lerp(
    v,
    lerp(u, grad(p[aa], x, y), grad(p[ba], x - 1, y)),
    lerp(u, grad(p[ab], x, y - 1), grad(p[bb], x - 1, y - 1)),
  );
}

/**
 * 3D グラデーション
 */
function grad3(hash, x, y, z) {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

/**
 * 3D Perlin Noise
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {number} -1 ~ 1
 */
export function noise3D(x, y, z) {
  let X = Math.floor(x) & 255;
  let Y = Math.floor(y) & 255;
  let Z = Math.floor(z) & 255;
  x -= Math.floor(x);
  y -= Math.floor(y);
  z -= Math.floor(z);
  const u = fade(x);
  const v = fade(y);
  const w = fade(z);
  const a = p[X] + Y;
  const aa = p[a] + Z;
  const ab = p[a + 1] + Z;
  const b = p[X + 1] + Y;
  const ba = p[b] + Z;
  const bb = p[b + 1] + Z;
  return lerp(
    w,
    lerp(
      v,
      lerp(u, grad3(p[aa], x, y, z), grad3(p[ba], x - 1, y, z)),
      lerp(u, grad3(p[ab], x, y - 1, z), grad3(p[bb], x - 1, y - 1, z)),
    ),
    lerp(
      v,
      lerp(u, grad3(p[aa + 1], x, y, z - 1), grad3(p[ba + 1], x - 1, y, z - 1)),
      lerp(
        u,
        grad3(p[ab + 1], x, y - 1, z - 1),
        grad3(p[bb + 1], x - 1, y - 1, z - 1),
      ),
    ),
  );
}
