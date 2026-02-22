import * as THREE from "three";
import { Mob } from "../Mob.js";
import { MathUtils, Vector3 } from "three";
import { EventBus } from "../../core/EventBus.js";

function createZombieTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  // ベース色（緑）
  ctx.fillStyle = "#55aa55";
  ctx.fillRect(0, 0, 128, 128);

  // マヌケな目（左右の大きさが違う）
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(20, 24, 32, 32); // 左目
  ctx.fillRect(80, 32, 24, 24); // 右目

  // 瞳
  ctx.fillStyle = "#000000";
  ctx.fillRect(36, 40, 12, 12);
  ctx.fillRect(84, 44, 12, 12);

  // ちょっとマヌケな口
  ctx.fillStyle = "#225522";
  ctx.fillRect(32, 80, 64, 16);

  // 飛び出た歯
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(48, 96, 16, 16);

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

const zombieFaceTex = createZombieTexture();
const defaultZombieColor = 0x55aa55;

export class Zombie extends Mob {
  /**
   * @param {import('../../world/World.js').World} world
   * @param {import('../../player/Physics.js').Physics} physics
   * @param {import('three').Scene} scene
   * @param {import('../../player/PlayerController.js').PlayerController} player
   */
  constructor(world, physics, scene, player) {
    super(world, physics, scene);
    this.player = player;

    this.health = 20;
    this.maxHealth = 20;

    // ゾンビサイズ（二足歩行の縦長モデル）
    this.halfWidth = 0.4;
    this.heightUp = 1.8;
    this.heightDown = 0;

    this.moveSpeed = 2.5;
    this.isAggressive = true;

    // 攻撃関連
    this.attackRange = 1.5;
    this.attackDamage = 2; // ハート1個分
    this.attackCooldown = 0;

    // 元のメッシュを破棄
    if (this.mesh && this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }

    // 表示用メッシュの再作成 (Groupで複数パーツをまとめる)
    this.mesh = new THREE.Group();

    const bodyMat = new THREE.MeshLambertMaterial({
      color: defaultZombieColor,
    });
    const faceMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      map: zombieFaceTex,
    });

    // --- 脚 (2本) ---
    // 幅:0.28, 高さ:0.6, 奥行き:0.28
    const legGeo = new THREE.BoxGeometry(0.28, 0.6, 0.28);
    legGeo.translate(0, 0.3, 0); // 足元を基準

    const leftLeg = new THREE.Mesh(legGeo, bodyMat);
    leftLeg.position.set(-0.15, 0, 0);
    this.mesh.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, bodyMat);
    rightLeg.position.set(0.15, 0, 0);
    this.mesh.add(rightLeg);

    // --- 胴体 ---
    // 幅:0.6, 高さ:0.7, 奥行き:0.3
    const bodyGeo = new THREE.BoxGeometry(0.6, 0.7, 0.3);
    bodyGeo.translate(0, 0.95, 0); // 足の高さ(0.6) + 胴体の半分(0.35)
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.mesh.add(bodyMesh);

    // --- 腕 (2本、前方に伸ばす) ---
    // 幅:0.25, 高さ:0.25, 奥行き:0.7
    const armGeo = new THREE.BoxGeometry(0.25, 0.25, 0.7);
    armGeo.translate(0, 1.175, 0.35); // Y:胴体上部寄り, Z:胴体から前に突き出す

    const leftArm = new THREE.Mesh(armGeo, bodyMat);
    leftArm.position.set(-0.425, 0, 0);
    this.mesh.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, bodyMat);
    rightArm.position.set(0.425, 0, 0);
    this.mesh.add(rightArm);

    // --- 頭 ---
    // 幅:0.5, 高さ:0.5, 奥行き:0.5
    const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    headGeo.translate(0, 1.55, 0); // 胴体の上(0.6+0.7+0.25)

    // 面インデックス: +X, -X, +Y, -Y, +Z(正面), -Z(背面)
    const headMaterials = [
      bodyMat,
      bodyMat,
      bodyMat,
      bodyMat,
      faceMat,
      bodyMat,
    ];
    const headMesh = new THREE.Mesh(headGeo, headMaterials);
    this.mesh.add(headMesh);

    this.scene.add(this.mesh);
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
            else if (m.color && m.map === null)
              m.color.setHex(defaultZombieColor);
          });
        }
      });
    }
  }

  updateAI(delta) {
    if (this.attackCooldown > 0) {
      this.attackCooldown -= delta;
    }

    // プレイヤーが死んでいなければ追跡する
    if (this.player && !this.player.health.isDead) {
      const playerPos = this.player.camera.position.clone();
      playerPos.y -= 1.6; // プレイヤーの足元の座標に近い値

      const dist = this.position.distanceTo(playerPos);

      // 一定距離（例: 24ブロック以内）なら感知して追っかける
      if (dist < 24.0) {
        this.aiState = "CHASE";
        this.aiTimer = 1.0;

        const dir = new Vector3().subVectors(playerPos, this.position);
        dir.y = 0; // 水平方向のみに正規化
        dir.normalize();

        this.velocity.x = dir.x * this.moveSpeed;
        this.velocity.z = dir.z * this.moveSpeed;

        // 攻撃範囲内ならプレイヤーにダメージを与える
        if (dist <= this.attackRange && this.attackCooldown <= 0) {
          this.player.health.damage(this.attackDamage, "zombie");
          this.attackCooldown = 1.0; // 1秒ごとに攻撃
        }
      } else {
        // プレイヤーを見失ったら通常の徘徊処理へフォールバック
        super.updateAI(delta);
      }
    } else {
      super.updateAI(delta);
    }
  }

  die() {
    super.die();
    // ここで腐った肉などのドロップ処理を入れる
    EventBus.emit("entity:killed", {
      pos: this.position.clone(),
      dropItem: "zombie_meat",
    });
  }
}
