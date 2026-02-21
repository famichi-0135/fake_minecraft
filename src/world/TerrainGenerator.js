import { noise, noise3D } from "../math/Noise.js";
import { seededRandom } from "../math/Random.js";
import { WATER_LEVEL, BOTTOM_Y } from "../core/Constants.js";

/**
 * バイオーム判定・地形高さ・鉱石配置・樹木生成
 */
export class TerrainGenerator {
  /**
   * バイオームを判定
   * @param {number} x
   * @param {number} z
   * @returns {string} バイオーム名
   */
  getBiome(x, z) {
    const bn = noise(x * 0.01 + 1000, z * 0.01 + 1000);
    if (bn < -0.2) return "savanna";
    if (bn > 0.4) return "snowy";
    if (bn > 0.2) return "mountain";
    return "plains";
  }

  /**
   * 指定座標の地形高さを計算
   * @param {number} x
   * @param {number} z
   * @param {string} biome
   * @returns {number}
   */
  getHeight(x, z, biome) {
    const bn = noise(x * 0.01 + 1000, z * 0.01 + 1000);
    let finalH = noise(x * 0.05, z * 0.05) + 0.5 * noise(x * 0.1, z * 0.1);
    if (biome === "mountain" || biome === "snowy") {
      finalH += Math.max(0, bn - 0.2) * 0.8;
    } else if (biome === "savanna") {
      finalH *= 0.5;
    }
    return Math.floor(finalH * 15);
  }

  /**
   * 表面ブロックの種類を決定
   * @param {string} biome
   * @param {number} h - 地形高さ
   * @param {number} x
   * @param {number} z
   * @returns {{ surface: string, sub: string }}
   */
  getSurfaceBlocks(biome, h, x, z) {
    let surface = "grass";
    let sub = "dirt";

    if (biome === "snowy") {
      surface = "snow";
      sub = "dirt";
    } else if (biome === "mountain" && h > 5) {
      surface = "stone";
      sub = "stone";
    } else if (biome === "savanna") {
      surface = "dry_grass";
    } else if (h === WATER_LEVEL || h === WATER_LEVEL + 1) {
      if (seededRandom(x, z) > 0.3) surface = "sand";
    }
    return { surface, sub };
  }

  /**
   * 鉱石タイプを判定（石の層のみ）
   * @param {number} y - Y座標
   * @returns {string|null} 鉱石ブロックID、or null (石のまま)
   */
  getOreType(y) {
    const r = Math.random();
    if (y < BOTTOM_Y + 15 && r < 0.002) return "diamond_ore";
    if (y < BOTTOM_Y + 30 && r < 0.005) return "gold_ore";
    if (r < 0.02) return "iron_ore";
    if (r < 0.04) return "coal_ore";
    return null;
  }

  /**
   * 洞窟判定 (3Dノイズ)
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} surfaceY - この列の地表高さ
   * @returns {boolean} trueなら空洞
   */
  isCave(x, y, z, surfaceY) {
    // 地表から3ブロック以内は保護
    if (y >= surfaceY - 2) return false;
    // 最底層も保護 (溶岩湖の床)
    if (y <= BOTTOM_Y + 1) return false;

    const scale1 = 0.07;
    const scale2 = 0.14;
    const n1 = noise3D(x * scale1, y * scale1, z * scale1);
    const n2 =
      noise3D(x * scale2 + 500, y * scale2 + 500, z * scale2 + 500) * 0.5;
    const combined = n1 + n2;

    // 深い場所ほど洞窟が出やすい
    const depthFactor = Math.max(0, 1 - (surfaceY - y) / 60);
    const threshold = 0.35 + depthFactor * 0.15;

    return combined > threshold;
  }

  /**
   * チャンク内のブロックデータを生成する
   * @param {number} startX - チャンク開始X座標
   * @param {number} startZ - チャンク開始Z座標
   * @param {number} chunkSize
   * @param {function} setBlockData - (bx, by, bz, type) => void
   */
  generateTerrain(startX, startZ, chunkSize, setBlockData) {
    for (let x = startX - 1; x <= startX + chunkSize; x++) {
      for (let z = startZ - 1; z <= startZ + chunkSize; z++) {
        const biome = this.getBiome(x, z);
        const h = this.getHeight(x, z, biome);

        if (h < WATER_LEVEL) {
          // 水面下
          for (let y = h; y >= BOTTOM_Y; y--) {
            setBlockData(x, y, z, y === h ? "sand" : "stone");
          }
          for (let y = h + 1; y <= WATER_LEVEL; y++) {
            setBlockData(
              x,
              y,
              z,
              biome === "snowy" && y === WATER_LEVEL ? "ice" : "water",
            );
          }
        } else {
          // 地上
          const { surface, sub } = this.getSurfaceBlocks(biome, h, x, z);

          for (let y = h; y >= BOTTOM_Y; y--) {
            let type = "stone";
            if (y === h) type = surface;
            else if (y > h - 4) type = sub;

            // 鉱石生成
            if (type === "stone" && y < h - 4) {
              const oreType = this.getOreType(y);
              if (oreType) type = oreType;
            }

            // 洞窟カービング
            if (this.isCave(x, y, z, h)) {
              // 溶岩湖 (最深部)
              if (y <= BOTTOM_Y + 5) {
                type = "lava";
              } else {
                continue; // 空気ブロック → setBlockDataしない
              }
            }

            setBlockData(x, y, z, type);
          }

          // 木の生成 (チャンク内のみ)
          if (
            x >= startX &&
            x < startX + chunkSize &&
            z >= startZ &&
            z < startZ + chunkSize
          ) {
            this._generateTree(x, z, h, biome, surface, setBlockData);
            // 花・草の自然配置
            this._generatePlants(x, z, h, biome, surface, setBlockData);
          }
        }
      }
    }
  }

  /**
   * 樹木生成
   * @private
   */
  _generateTree(x, z, h, biome, surface, setBlockData) {
    if (
      h <= WATER_LEVEL + 1 ||
      surface === "stone" ||
      surface === "sand" ||
      surface === "snow"
    ) {
      return;
    }

    const r = seededRandom(x + 100, z + 100);

    if (biome === "savanna" && r < 0.01) {
      // アカシアの木
      setBlockData(x, h + 1, z, "acacia_wood");
      setBlockData(x, h + 2, z, "acacia_wood");
      setBlockData(x + 1, h + 3, z, "acacia_wood");
      setBlockData(x + 1, h + 4, z, "acacia_wood");
      for (let lx = -2; lx <= 2; lx++) {
        for (let lz = -2; lz <= 2; lz++) {
          if (Math.abs(lx) + Math.abs(lz) <= 3) {
            setBlockData(x + 1 + lx, h + 5, z + lz, "acacia_leaves");
          }
        }
      }
    } else if (biome === "plains" && r < 0.02) {
      // オークの木
      const tH = Math.floor(seededRandom(x, z) * 2) + 4;
      for (let i = 0; i < tH; i++) {
        setBlockData(x, h + 1 + i, z, "wood");
      }
      for (let lx = -2; lx <= 2; lx++) {
        for (let ly = tH - 2; ly <= tH + 1; ly++) {
          for (let lz = -2; lz <= 2; lz++) {
            if (
              Math.abs(lx) + Math.abs(lz) + Math.abs(ly - tH) <= 3 &&
              !(lx === 0 && lz === 0 && ly < tH)
            ) {
              setBlockData(x + lx, h + 1 + ly, z + lz, "leaves");
            }
          }
        }
      }
    }
  }

  /**
   * 花・草の自然配置
   * @private
   */
  _generatePlants(x, z, h, biome, surface, setBlockData) {
    if (
      h <= WATER_LEVEL ||
      surface === "stone" ||
      surface === "sand" ||
      surface === "snow"
    )
      return;

    const r = seededRandom(x * 3 + 50, z * 3 + 50);

    if (biome === "plains" || biome === "savanna") {
      if (r < 0.05) {
        setBlockData(x, h + 1, z, "tall_grass");
      } else if (r > 0.97) {
        setBlockData(x, h + 1, z, "flower_red");
      } else if (r > 0.95 && r <= 0.97) {
        setBlockData(x, h + 1, z, "flower_yellow");
      }
    }

    // りんごドロップ（木の近くに低確率で）
    if (biome === "plains" && r > 0.993) {
      setBlockData(x, h + 1, z, "tall_grass");
    }
  }
}
