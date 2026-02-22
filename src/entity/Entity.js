import * as THREE from "three";
import { GRAVITY } from "../core/Constants.js";

/**
 * 全ての動的オブジェクト（Mob、アイテム等）のベースクラス
 */
export class Entity {
  /**
   * @param {import('../world/World.js').World} world
   * @param {import('../player/Physics.js').Physics} physics
   */
  constructor(world, physics) {
    this.world = world;
    this.physics = physics;

    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();

    // 当たり判定のサイズ
    this.halfWidth = 0.4;
    this.heightDown = 0.0;
    this.heightUp = 1.8;

    this.health = 20;
    this.maxHealth = 20;

    this.onGround = false;
    this.isDead = false;

    // Entity固有のID
    this.id = Math.random().toString(36).substring(2, 9);
  }

  /**
   * @param {number} delta - デルタタイム(秒)
   */
  update(delta) {
    if (this.isDead) return;

    // 重力と移動の計算
    this.velocity.y -= GRAVITY * delta;

    // Y軸移動
    this.position.y += this.velocity.y * delta;
    if (
      this.physics.checkAABBCollision(
        this.position.x,
        this.position.y,
        this.position.z,
        this.halfWidth,
        this.heightDown,
        this.heightUp,
      )
    ) {
      if (this.velocity.y < 0) {
        this.onGround = true;
        this.position.y =
          Math.floor(this.position.y - this.heightDown) + 0.5 + this.heightDown;
      } else {
        this.position.y =
          Math.ceil(this.position.y + this.heightUp) - 0.5 - this.heightUp;
      }
      this.velocity.y = 0;
    } else {
      this.onGround = false;
    }

    // X軸移動
    this.position.x += this.velocity.x * delta;
    if (
      this.physics.checkAABBCollision(
        this.position.x,
        this.position.y,
        this.position.z,
        this.halfWidth,
        this.heightDown,
        this.heightUp,
      )
    ) {
      this.position.x -= this.velocity.x * delta;
      this.velocity.x = 0;
    }

    // Z軸移動
    this.position.z += this.velocity.z * delta;
    if (
      this.physics.checkAABBCollision(
        this.position.x,
        this.position.y,
        this.position.z,
        this.halfWidth,
        this.heightDown,
        this.heightUp,
      )
    ) {
      this.position.z -= this.velocity.z * delta;
      this.velocity.z = 0;
    }
  }

  takeDamage(amount, source) {
    this.health -= amount;
    if (this.health <= 0) {
      this.die();
    }
  }

  die() {
    this.isDead = true;
  }
}
