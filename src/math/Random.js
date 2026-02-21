// グローバルシード値 (ワールドごとに設定される)
let globalSeed = 0;

/**
 * グローバルシード値を設定する
 * @param {number} seed
 */
export function setGlobalSeed(seed) {
  globalSeed = seed;
}

/**
 * Linear Congruential Generator (LCG) による疑似乱数生成器
 * @param {number} seed - 初期シード値
 * @returns {function(): number} 0~1 の乱数を返す関数
 */
export function LCG(seed) {
  return function () {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

/**
 * 座標ベースの決定論的乱数（Sin ハッシュ）
 * @param {number} x
 * @param {number} z
 * @returns {number} 0~1 の擬似乱数
 */
export function seededRandom(x, z) {
  // グローバルシード値をオフセットとして加算し、ワールドごとに異なる結果にする
  const n =
    Math.sin((x + globalSeed) * 12.9898 + (z + globalSeed) * 78.233) *
    43758.5453;
  return n - Math.floor(n);
}
