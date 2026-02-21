import * as THREE from "three";
import { EventBus } from "../core/EventBus.js";

/**
 * パーティクルシステム — ブロック破壊・ヒット時のエフェクト
 */
export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    /** @type {Array<{mesh: THREE.Mesh, vel: THREE.Vector3, life: number}>} */
    this.particles = [];
    this.maxParticles = 200;

    EventBus.on("block:destroyed", ({ pos, type }) => {
      this.spawnBlockBreak(pos, type);
    });
  }

  /**
   * ブロック破壊パーティクル
   */
  spawnBlockBreak(pos, type) {
    const colors = {
      stone: 0x888888,
      dirt: 0x654321,
      grass: 0x4a8505,
      sand: 0xeadd9e,
      wood: 0x5c4033,
      leaves: 0x228b22,
      cobblestone: 0x666666,
      snow: 0xffffff,
      default: 0xaaaaaa,
    };
    const color = colors[type] || colors.default;

    const count = 6;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
      const mat = new THREE.MeshBasicMaterial({ color });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        pos.x + (Math.random() - 0.5) * 0.6,
        pos.y + (Math.random() - 0.5) * 0.6,
        pos.z + (Math.random() - 0.5) * 0.6,
      );
      this.scene.add(mesh);

      this.particles.push({
        mesh,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          Math.random() * 5 + 2,
          (Math.random() - 0.5) * 4,
        ),
        life: 0.6 + Math.random() * 0.4,
      });
    }
  }

  /**
   * 毎フレーム更新
   */
  update(delta) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= delta;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }
      p.vel.y -= 20 * delta;
      p.mesh.position.addScaledVector(p.vel, delta);
      p.mesh.material.opacity = Math.max(0, p.life);
      p.mesh.material.transparent = true;
      p.mesh.rotation.x += delta * 5;
      p.mesh.rotation.z += delta * 3;
    }
  }
}
