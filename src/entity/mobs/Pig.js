import * as THREE from "three";
import { Mob } from "../Mob.js";
import { MathUtils } from "three";
import { EventBus } from "../../core/EventBus.js";

function createPigTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  // ベース色（ピンク）
  ctx.fillStyle = "#ffb6c1";
  ctx.fillRect(0, 0, 128, 128);

  // 目（黒）
  ctx.fillStyle = "#333333";
  ctx.fillRect(24, 48, 16, 24);
  ctx.fillRect(88, 48, 16, 24);

  // 鼻（少し濃いピンク）
  ctx.fillStyle = "#ff99aa";
  ctx.fillRect(40, 72, 48, 32);

  // 鼻の穴
  ctx.fillStyle = "#cc5566";
  ctx.fillRect(48, 80, 12, 16);
  ctx.fillRect(68, 80, 12, 16);

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

const pigFaceTex = createPigTexture();
const defaultPigColor = 0xffb6c1;

export class Pig extends Mob {
  constructor(world, physics, scene) {
    super(world, physics, scene);

    this.health = 10;
    this.maxHealth = 10;

    // 豚のサイズ設定 (要望: x:1, y:2, z:1)
    // 物理エンジン用は少しだけ小さく設定してスタックを防ぐ
    this.halfWidth = 0.45;
    this.heightUp = 1.9;

    this.moveSpeed = 1.0; // 歩く速度は遅め
    this.isAggressive = false;

    // 元のメッシュを破棄
    if (this.mesh && this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }

    // 表示用メッシュの再作成 (Groupで複数パーツをまとめる)
    this.mesh = new THREE.Group();

    const bodyMat = new THREE.MeshLambertMaterial({ color: defaultPigColor });
    const faceMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      map: pigFaceTex,
    });

    // --- 胴体 ---
    // 横幅:0.6, 高さ:0.6, 奥行き(長さ):1.2
    const bodyGeo = new THREE.BoxGeometry(0.6, 0.6, 1.2);
    // Yオフセット: 足の長さ(0.3) + 高さの半分(0.3) = 0.6
    bodyGeo.translate(0, 0.6, 0);
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.mesh.add(bodyMesh);

    // --- 頭 ---
    // 幅:0.6, 高さ:0.6, 奥行き:0.6
    const headGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    // 胴体の前(+Z)に配置。胴体の中心Yと同じ高さにする。
    // Zオフセット: 胴体の長さの半分(0.6) + 頭の半分(0.3) = 0.9
    headGeo.translate(0, 0.7, 0.9);

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

    // --- 足 (4本) ---
    // 幅:0.2, 高さ:0.3, 奥行き:0.2
    const legGeo = new THREE.BoxGeometry(0.2, 0.3, 0.2);
    legGeo.translate(0, 0.15, 0); // 足元を0基準

    // 配置座標 (X, Z)
    const legPositions = [
      [-0.2, 0.4], // 左前
      [0.2, 0.4], // 右前
      [-0.2, -0.4], // 左後ろ
      [0.2, -0.4], // 右後ろ
    ];

    legPositions.forEach((pos) => {
      const legMesh = new THREE.Mesh(legGeo, bodyMat);
      legMesh.position.set(pos[0], 0, pos[1]);
      this.mesh.add(legMesh);
    });

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
            else if (m.color && m.map === null) m.color.setHex(defaultPigColor);
          });
        }
      });
    }
  }

  updateAI(delta) {
    super.updateAI(delta);

    // 豚はランダムにブヒブヒ鳴くなどの拡張が可能
  }

  takeDamage(amount, source) {
    super.takeDamage(amount, source);
    // 攻撃されたら逃げ回るAIにステートを強制変更
    if (!this.isDead) {
      this.aiState = "FLEE";
      this.aiTimer = 3.0; // 3秒間パニック
      this.moveSpeed = 3.0; // 走る

      this.velocity.x += (Math.random() - 0.5) * 5;
      this.velocity.z += (Math.random() - 0.5) * 5;
    }
  }

  die() {
    super.die();
    // ここで生肉などのアイテムをドロップする処理を呼ぶ
    EventBus.emit("entity:killed", {
      pos: this.position.clone(),
      dropItem: "raw_meat",
    });
  }
}
