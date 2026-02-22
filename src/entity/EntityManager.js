import * as THREE from "three";

/**
 * ワールド内のエンティティ（Mob、ドロップアイテム等）を管理・更新するクラス
 */
export class EntityManager {
  /**
   * @param {THREE.Scene} scene
   * @param {import('../world/World.js').World} world
   */
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;

    // 現在アクティブなエンティティ一覧
    /** @type {Set<import('./Entity.js').Entity>} */
    this.entities = new Set();
  }

  /**
   * エンティティをワールドに追加する
   * @param {import('./Entity.js').Entity} entity
   */
  add(entity) {
    this.entities.add(entity);
    if (entity.mesh) {
      this.scene.add(entity.mesh);
    }
  }

  /**
   * エンティティをワールドから削除する
   * @param {import('./Entity.js').Entity} entity
   */
  remove(entity) {
    this.entities.delete(entity);
    if (entity.mesh) {
      this.scene.remove(entity.mesh);
    }
  }

  /**
   * 毎フレームの更新ループ
   * @param {number} delta - デルタタイム(秒)
   */
  update(delta) {
    for (const entity of this.entities) {
      // 死亡確認
      if (entity.isDead) {
        this.remove(entity);
        continue;
      }

      // 個別の更新
      entity.update(delta);

      // モデル(Mesh)の座標同期
      if (entity.mesh) {
        entity.mesh.position.copy(entity.position);
      }
    }
  }

  /**
   * 指定した座標・半径内にある対象エンティティを取得する
   * @param {THREE.Vector3} pos
   * @param {number} radius
   * @param {boolean} includeDead
   * @returns {import('./Entity.js').Entity[]}
   */
  getEntitiesInRange(pos, radius, includeDead = false) {
    const results = [];
    for (const entity of this.entities) {
      if (!includeDead && entity.isDead) continue;
      if (entity.position.distanceTo(pos) <= radius) {
        results.push(entity);
      }
    }
    return results;
  }
}
