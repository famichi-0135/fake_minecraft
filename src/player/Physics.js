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

  checkCollision(px, py, pz) {
    const hw = PLAYER_HALF_WIDTH;
    const minX = Math.floor(px - hw + 0.5);
    const maxX = Math.floor(px + hw + 0.5);
    const minY = Math.floor(py - PLAYER_HEIGHT + 0.5);
    const maxY = Math.floor(py + PLAYER_HEAD_MARGIN + 0.5);
    const minZ = Math.floor(pz - hw + 0.5);
    const maxZ = Math.floor(pz + hw + 0.5);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const type = this.world.getSolidBlockType(x, y, z);
          if (type && !Physics.NON_SOLID.has(type)) return true;
        }
      }
    }
    return false;
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
