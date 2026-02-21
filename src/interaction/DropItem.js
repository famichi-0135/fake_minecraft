import * as THREE from "three";
import {
  PICKUP_RADIUS,
  ABSORB_RADIUS,
  ABSORB_SPEED,
  MAX_DROP_ITEMS,
} from "../core/Constants.js";
import { EventBus } from "../core/EventBus.js";
import { Chunk } from "../world/Chunk.js";

/**
 * ドロップアイテムの生成・浮遊・プレイヤーへの吸収
 */
export class DropItemManager {
  /**
   * @param {THREE.Scene} scene
   * @param {import('../rendering/MaterialFactory.js').MaterialFactory} materialFactory
   */
  constructor(scene, materialFactory) {
    this.scene = scene;
    this.materialFactory = materialFactory;
    /** @type {Array} */
    this.items = [];
  }

  /**
   * ドロップアイテムを生成
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {string} type
   */
  spawn(x, y, z, type) {
    const mat = this.materialFactory.get(type);
    if (!mat || type === "water") return;

    const mesh = new THREE.Mesh(Chunk.boxGeometry, mat);
    mesh.scale.set(0.25, 0.25, 0.25);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.items.push({ mesh, type, baseY: y, time: 0, isAbsorbing: false });
  }

  /**
   * 毎フレーム更新 — 浮遊アニメーション・吸収処理
   * @param {number} delta
   * @param {THREE.Vector3} playerPos
   */
  update(delta, playerPos) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.time += delta;
      item.mesh.rotation.y += delta * 2;

      if (item.mesh.position.distanceTo(playerPos) < PICKUP_RADIUS) {
        item.isAbsorbing = true;
        const dir = new THREE.Vector3()
          .subVectors(playerPos, item.mesh.position)
          .normalize();
        item.mesh.position.add(dir.multiplyScalar(delta * ABSORB_SPEED));

        if (item.mesh.position.distanceTo(playerPos) < ABSORB_RADIUS) {
          this.scene.remove(item.mesh);
          EventBus.emit("item:picked", { type: item.type, count: 1 });
          this.items.splice(i, 1);
          continue;
        }
      } else {
        item.isAbsorbing = false;
      }

      if (!item.isAbsorbing) {
        item.mesh.position.y = item.baseY + Math.sin(item.time * 4) * 0.15;
      }
    }

    // ドロップ上限管理
    if (this.items.length > MAX_DROP_ITEMS) {
      this.scene.remove(this.items[0].mesh);
      this.items.shift();
    }
  }
}
