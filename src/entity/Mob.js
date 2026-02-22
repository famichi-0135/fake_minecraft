import * as THREE from "three";
import { Entity } from "./Entity.js";
import { EventBus } from "../core/EventBus.js";

/**
 * AIやメッシュモデル（簡易Box等）を持つモブのベースクラス
 */
export class Mob extends Entity {
  /**
   * @param {import('../world/World.js').World} world
   * @param {import('../player/Physics.js').Physics} physics
   * @param {THREE.Scene} scene
   */
  constructor(world, physics, scene) {
    super(world, physics);
    this.scene = scene;

    // AIのタイマーと状態
    this.aiState = "IDLE";
    this.aiTimer = 0;
    this.moveTarget = new THREE.Vector3();
    this.moveSpeed = 2.0;
    this.isAggressive = false;

    // ダメージ後の無敵時間・ノックバック制御
    this.damageCooldown = 0;

    // 表示用の仮メッシュ（子クラスで上書き推奨）
    const geo = new THREE.BoxGeometry(
      this.halfWidth * 2,
      this.heightUp,
      this.halfWidth * 2,
    );
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.Mesh(geo, mat);

    // Yオフセット（Entityの基準座標は足元や中心など様々だが、今回は足元想定で BoxGeometry を持ち上げる）
    geo.translate(0, this.heightUp / 2, 0);
  }

  update(delta) {
    if (this.isDead) return;

    if (this.damageCooldown > 0) {
      this.damageCooldown -= delta;
      // ダメージ時は少し赤く点滅させるなど
      if (this.mesh) {
        if (Math.floor(this.damageCooldown * 10) % 2 === 0) {
          this.mesh.traverse((child) => {
            if (child.isMesh && child.material) {
              const mats = Array.isArray(child.material)
                ? child.material
                : [child.material];
              mats.forEach((m) => {
                if (m.emissive)
                  m.emissive.setHex(0xaa0000); // 赤く発光させる
                else if (m.color && m.map === null) m.color.setHex(0xff0000);
              });
            }
          });
        } else {
          this.resetColor();
        }
      }
    } else {
      this.resetColor();
      this.updateAI(delta);
    }

    super.update(delta);

    if (this.mesh && this.mesh.position) {
      this.mesh.position.copy(this.position);

      // 進行方向へ向く（速度ベクトルがある場合のみ）
      if (this.velocity.x !== 0 || this.velocity.z !== 0) {
        const targetAngle = Math.atan2(this.velocity.x, this.velocity.z); // Z軸+を正面とする場合
        this.mesh.rotation.y = targetAngle;
      }
    }
  }

  resetColor() {
    if (this.mesh) {
      this.mesh.traverse((child) => {
        if (child.isMesh && child.material) {
          const mats = Array.isArray(child.material)
            ? child.material
            : [child.material];
          mats.forEach((m) => {
            if (m.emissive) m.emissive.setHex(0x000000);
            else if (m.color) m.color.setHex(0xffffff); // ベースカラー (子クラスでオーバーライド)
          });
        }
      });
    }
  }

  /**
   * @virtual 子クラスで個別のAIロジックを実装する
   */
  updateAI(delta) {
    // デフォルトはランダム徘徊
    this.aiTimer -= delta;
    if (this.aiTimer <= 0) {
      if (this.aiState === "IDLE") {
        this.aiState = "WANDER";
        this.aiTimer = 1.0 + Math.random() * 2.0;

        // ランダムな方向へ
        const angle = Math.random() * Math.PI * 2;
        this.velocity.x = Math.cos(angle) * this.moveSpeed;
        this.velocity.z = Math.sin(angle) * this.moveSpeed;
      } else {
        this.aiState = "IDLE";
        this.aiTimer = 2.0 + Math.random() * 3.0;
        this.velocity.x = 0;
        this.velocity.z = 0;
      }
    }

    // 進行方向に段差があればジャンプ
    if (this.onGround && (this.velocity.x !== 0 || this.velocity.z !== 0)) {
      // 簡易的な前方の衝突テスト (XかZの強い方にレイを飛ばす等)
      // ここでは簡易的に、X方向かZ方向で壁にぶつかって velocity が 0 にリセットされていたらジャンプを試みる
      // (親クラスの collision で0にされる)
      // より賢いAIは、移動前にRaycasterで高さを測る。
    }
  }

  takeDamage(amount, source) {
    if (this.damageCooldown > 0) return; // 無敵時間

    super.takeDamage(amount, source);
    this.damageCooldown = 0.5;

    // ダメージエフェクト（パーティクル）用のイベント発火
    EventBus.emit("entity:damaged", { pos: this.position.clone() });

    // ノックバック処理
    if (source && source.position) {
      const dir = new THREE.Vector3().subVectors(
        this.position,
        source.position,
      );
      dir.y = 0;
      dir.normalize();
      this.velocity.x = dir.x * 5; // ノックバック力
      this.velocity.z = dir.z * 5;
      this.velocity.y = 4; // 少し浮かせる
    }
  }
}
