import {
  PLAYER_HALF_WIDTH,
  PLAYER_HEIGHT,
  PLAYER_HEAD_MARGIN,
} from "../core/Constants.js";

/**
 * AABB ベースの衝突検出
 */
export class Physics {
  /**
   * @param {import('../world/World.js').World} world
   */
  constructor(world) {
    this.world = world;
  }

  /**
   * 指定位置にプレイヤーが衝突するか判定
   * @param {number} px - プレイヤーX
   * @param {number} py - プレイヤーY (カメラ位置 = 目の高さ)
   * @param {number} pz - プレイヤーZ
   * @returns {boolean}
   */
  /** 通過可能ブロック */
  static NON_SOLID = new Set([
    "water",
    "lava",
    "flower_red",
    "flower_yellow",
    "tall_grass",
    "torch",
    "ladder",
  ]);

  /**
   * 指定したAABBが地形と衝突するかを判定する (エンティティ全般用)
   * @param {number} x - 中心X
   * @param {number} y - 基準Y (足元や目線など)
   * @param {number} z - 中心Z
   * @param {number} halfWidth - 幅の半分 (X, Z方向)
   * @param {number} heightDown - 下方向の高さ (基準Yから足下まで)
   * @param {number} heightUp - 上方向の高さ (基準Yから頭頂まで)
   * @returns {boolean}
   */
  checkAABBCollision(x, y, z, halfWidth, heightDown, heightUp) {
    const minX = Math.floor(x - halfWidth + 0.5);
    const maxX = Math.floor(x + halfWidth + 0.5);
    const minY = Math.floor(y - heightDown + 0.5);
    const maxY = Math.floor(y + heightUp + 0.5);
    const minZ = Math.floor(z - halfWidth + 0.5);
    const maxZ = Math.floor(z + halfWidth + 0.5);

    const eMinX = x - halfWidth;
    const eMaxX = x + halfWidth;
    const eMinY = y - heightDown;
    const eMaxY = y + heightUp;
    const eMinZ = z - halfWidth;
    const eMaxZ = z + halfWidth;

    for (let bx = minX; bx <= maxX; bx++) {
      for (let by = minY; by <= maxY; by++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          const type = this.world.getSolidBlockType(bx, by, bz);
          if (type && !Physics.NON_SOLID.has(type)) {
            let bMinX = bx - 0.5;
            let bMaxX = bx + 0.5;
            let bMinY = by - 0.5;
            let bMaxY = by + 0.5;
            let bMinZ = bz - 0.5;
            let bMaxZ = bz + 0.5;

            // 特殊形状ブロックのAABB調整
            const blockDef = this.world.blockRegistry.get(type);
            if (blockDef) {
              if (blockDef.model === "slab") {
                bMaxY = by; // ハーフブロックは高さ半分
              } else if (blockDef.model === "stair") {
                // 階段（向き固定：+Z方向へ登るよう、-Z側に上段があると仮定）
                const lowerHit =
                  eMinX < bMaxX &&
                  eMaxX > bMinX &&
                  eMinY < by &&
                  eMaxY > bMinY &&
                  eMinZ < bMaxZ &&
                  eMaxZ > bMinZ;

                const upperHit =
                  eMinX < bMaxX &&
                  eMaxX > bMinX &&
                  eMinY < bMaxY &&
                  eMaxY > by &&
                  eMinZ < bz &&
                  eMaxZ > bMinZ; // Zが bz より小さい側（半分）

                if (lowerHit || upperHit) return true;
                continue; // 個別に判定したため以降のデフォルト判定をスキップ
              }
            }

            // AABB同士の交差判定 (フルブロック・ハーフブロック用)
            if (
              eMinX < bMaxX &&
              eMaxX > bMinX &&
              eMinY < bMaxY &&
              eMaxY > bMinY &&
              eMinZ < bMaxZ &&
              eMaxZ > bMinZ
            ) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  /**
   * プレイヤー用の衝突判定 (従来のメソッド互換)
   * @param {number} px - プレイヤーX
   * @param {number} py - プレイヤーY (カメラ位置 = 目の高さ)
   * @param {number} pz - プレイヤーZ
   * @returns {boolean}
   */
  checkCollision(px, py, pz) {
    return this.checkAABBCollision(
      px,
      py,
      pz,
      PLAYER_HALF_WIDTH,
      PLAYER_HEIGHT,
      PLAYER_HEAD_MARGIN,
    );
  }

  /**
   * ブロック設置時のプレイヤー重複チェック
   * @param {number} vx - ブロックX
   * @param {number} vy - ブロックY
   * @param {number} vz - ブロックZ
   * @param {number} px - プレイヤーX
   * @param {number} py - プレイヤーY
   * @param {number} pz - プレイヤーZ
   * @returns {boolean} 重複する場合 true
   */
  isOverlappingPlayer(vx, vy, vz, px, py, pz) {
    const overlapX = Math.abs(vx - px) < 0.8;
    const overlapY =
      vy - 0.5 < py + PLAYER_HEAD_MARGIN && vy + 0.5 > py - PLAYER_HEIGHT;
    const overlapZ = Math.abs(vz - pz) < 0.8;
    return overlapX && overlapY && overlapZ;
  }
}
