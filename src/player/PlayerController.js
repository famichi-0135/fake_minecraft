import * as THREE from "three";
import {
  WALK_SPEED,
  RUN_SPEED,
  JUMP_VELOCITY,
  GRAVITY,
  FRICTION,
  PLAYER_HEIGHT,
  PLAYER_HEAD_MARGIN,
  CHUNK_SIZE,
} from "../core/Constants.js";
import { EventBus } from "../core/EventBus.js";

/**
 * プレイヤーの移動・ジャンプ・走行物理演算
 */
export class PlayerController {
  /**
   * @param {THREE.Camera} camera
   * @param {import('./InputManager.js').InputManager} inputManager
   * @param {import('./Physics.js').Physics} physics
   * @param {import('../world/World.js').World} world
   */
  constructor(camera, inputManager, physics, world) {
    this.camera = camera;
    this.input = inputManager;
    this.physics = physics;
    this.world = world;

    this.velocity = new THREE.Vector3();
    this.canJump = false;
    this.inWater = false; // main.jsから参照可能
    this.health = null; // main.js からセット
    this._fallStartY = null;

    // 地形生成待ちフラグ (初期生成時に即落下死するのを防ぐ)
    this.isWorldReady = false;
    this.isInitialFall = true; // 初回スポーン時の落下ダメージを無効化するためのフラグ

    // ジャンプイベント
    EventBus.on("input:jump", () => {
      if (this.canJump) {
        this.velocity.y = JUMP_VELOCITY;
        this.canJump = false;
      }
    });
  }

  /**
   * 毎フレームの物理更新
   * @param {number} delta - 経過秒
   */
  update(delta) {
    const pos = this.camera.position;

    // チャンク更新
    const cx = Math.floor(pos.x / CHUNK_SIZE);
    const cz = Math.floor(pos.z / CHUNK_SIZE);
    this.world.updateChunks(cx, cz);

    // 地形生成が完了するまで物理演算をストップして空中に待機させる
    if (!this.isWorldReady) {
      if (this.world.isChunkLoaded(cx, cz)) {
        this.isWorldReady = true;
      } else {
        this.velocity.set(0, 0, 0);
        return;
      }
    }

    // 水中判定（頭の位置も含めて判定）
    const feetBlockType = this.world.getBlockTypeAt(
      Math.floor(pos.x),
      Math.floor(pos.y - PLAYER_HEIGHT + 0.5),
      Math.floor(pos.z),
    );
    const headBlockType = this.world.getBlockTypeAt(
      Math.floor(pos.x),
      Math.floor(pos.y),
      Math.floor(pos.z),
    );
    const inWater = feetBlockType === "water" || headBlockType === "water";
    this.inWater = inWater; // 公開プロパティを更新
    const waterSpeedMul = inWater ? 0.85 : 1.0;

    // 水平移動
    const speed =
      (this.input.isRunning ? RUN_SPEED : WALK_SPEED) * waterSpeedMul;
    this.velocity.x -= this.velocity.x * FRICTION * delta;
    this.velocity.z -= this.velocity.z * FRICTION * delta;

    const front = new THREE.Vector3();
    this.camera.getWorldDirection(front);
    front.y = 0;
    front.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(front, new THREE.Vector3(0, 1, 0)).normalize();

    const inputDir = new THREE.Vector3();
    if (this.input.moveForward) inputDir.add(front);
    if (this.input.moveBackward) inputDir.sub(front);
    if (this.input.moveRight) inputDir.add(right);
    if (this.input.moveLeft) inputDir.sub(right);
    inputDir.normalize();

    if (inputDir.lengthSq() > 0) {
      this.velocity.x += inputDir.x * speed * delta;
      this.velocity.z += inputDir.z * speed * delta;
    }

    // X軸衝突判定
    const nextX = pos.x + this.velocity.x * delta;
    if (!this.physics.checkCollision(nextX, pos.y, pos.z)) {
      pos.x = nextX;
    } else {
      this.velocity.x = 0;
    }

    // Z軸衝突判定
    const nextZ = pos.z + this.velocity.z * delta;
    if (!this.physics.checkCollision(pos.x, pos.y, nextZ)) {
      pos.z = nextZ;
    } else {
      this.velocity.z = 0;
    }

    // 重力 & Y軸衝突判定
    if (inWater) {
      // 水中: 浮力で重力減少 + ジャンプキーで浮上
      this.velocity.y -= GRAVITY * 0.3 * delta;
      this.velocity.y *= 0.95; // 水の抵抗
      if (this.input.jump) {
        this.velocity.y = Math.max(this.velocity.y, 3);
      }
      this._fallStartY = null; // 水中では落下ダメージなし
      this.canJump = true;
    } else {
      this.velocity.y -= GRAVITY * delta;
    }
    const nextY = pos.y + this.velocity.y * delta;

    if (!this.physics.checkCollision(pos.x, nextY, pos.z)) {
      pos.y = nextY;
      if (!inWater) this.canJump = false;

      // 空中: 落下開始Yを記録
      if (this._fallStartY === null && !inWater) {
        this._fallStartY = pos.y;
      }
    } else {
      if (this.velocity.y < 0) {
        // 着地
        this.canJump = true;
        const blockY = Math.floor(nextY - PLAYER_HEIGHT + 0.5);
        pos.y = blockY + 0.5 + PLAYER_HEIGHT + 0.001;

        // 落下ダメージ判定
        if (this.health && this._fallStartY !== null) {
          if (this.isInitialFall) {
            // 初回スポーン時の落下ではダメージを受けない
            this.isInitialFall = false;
          } else {
            this.health.checkFallDamage(this._fallStartY, pos.y);
          }
        }
        this._fallStartY = null;
      } else {
        // 天井衝突
        const blockY = Math.floor(nextY + PLAYER_HEAD_MARGIN + 0.5);
        pos.y = blockY - 0.5 - PLAYER_HEAD_MARGIN - 0.001;
      }
      this.velocity.y = 0;
    }

    // 奈落落下
    if (pos.y < -60) {
      if (this.health) {
        this.health.damage(20, "void");
      }
      this.velocity.set(0, 0, 0);
      pos.set(8, 60, 8);
      this._fallStartY = null;
    }
  }
}
