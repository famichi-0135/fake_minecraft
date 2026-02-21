import * as THREE from "three";
import { REACH_DISTANCE, BOTTOM_Y, CHUNK_SIZE } from "../core/Constants.js";

/**
 * ブロックへの視線判定 (BufferGeometry メッシュ対応版)
 */
export class BlockRaycaster {
  /**
   * @param {THREE.Camera} camera
   * @param {THREE.Scene} scene
   * @param {import('../world/World.js').World} world
   */
  constructor(camera, scene, world) {
    this.camera = camera;
    this.scene = scene;
    this.world = world;
    this.raycaster = new THREE.Raycaster();
  }

  /**
   * プレイヤー視線先にあるブロックを取得
   * @returns {{ object: THREE.Mesh, face: THREE.Face, point: THREE.Vector3, voxelData: Object } | null}
   */
  getLookingAtBlock() {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

    // ChunkMeshBuilderで作られたChunk.meshをすべて取得するのではなく、
    // プレイヤーの周囲数チャンク（例：現在地を中心とした3x3チャンク）のメッシュのみを判定対象とする
    const meshes = [];
    const px = this.camera.position.x;
    const pz = this.camera.position.z;

    // チャンクサイズは外部から渡されていないため定数を再利用する形にするか、
    // あるいはUserDataを利用してフィルタする
    // Object3Dのchildrenから距離判定して拾うほうが早い
    this.scene.children.forEach((obj) => {
      if (obj.isMesh && obj.userData.isChunkMesh && obj.userData.chunk) {
        const chunk = obj.userData.chunk;

        // chunk.cx, chunk.cz はチャンク座標
        // プレイヤーのチャンク座標との差分が1以内のチャンクだけをテスト対象にする
        const playerCX = Math.floor(px / 16); // CHUNK_SIZE = 16
        const playerCZ = Math.floor(pz / 16);

        if (
          Math.abs(chunk.cx - playerCX) <= 1 &&
          Math.abs(chunk.cz - playerCZ) <= 1
        ) {
          // カメラのカリング判定も一応済ませる(すでに背後ならスキップ)
          meshes.push(obj);
        }
      }
    });

    const intersects = this.raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0 && intersects[0].distance < REACH_DISTANCE) {
      const hit = intersects[0];
      const chunk = hit.object.userData.chunk;

      // 衝突点と法線から、クリック対象のブロック座標を幾何学的に特定する
      // (法線の逆方向へ少し進んでから整数化)
      const hitNormal = hit.face ? hit.face.normal : new THREE.Vector3();
      // Raycasterはメッシュとの交差点が頂点上や辺上に乗る可能性があるため、少しだけ内側へめり込ませる
      const eps = 0.05;
      const blockPoint = new THREE.Vector3()
        .copy(hit.point)
        .sub(hitNormal.clone().multiplyScalar(eps));

      const vx = Math.round(blockPoint.x);
      const vy = Math.round(blockPoint.y);
      const vz = Math.round(blockPoint.z);

      if (chunk && chunk.blockData && this.world) {
        // Uint8Arrayへの平坦化対応
        const lx = vx - chunk.cx * CHUNK_SIZE;
        const ly = vy - BOTTOM_Y;
        const lz = vz - chunk.cz * CHUNK_SIZE;

        const idx = this.world._getBlockIndex(lx, ly, lz);
        if (idx !== -1) {
          const intType = chunk.blockData[idx];
          const type = this.world.blockRegistry.getBlockName(intType);

          if (type && type !== "air") {
            // 下位互換オブジェクト
            return {
              object: {
                position: new THREE.Vector3(vx, vy, vz),
                userData: { type: type },
              },
              face: { normal: hitNormal },
              point: hit.point,
              voxelData: { x: vx, y: vy, z: vz, type: type, normal: hitNormal },
              chunkMesh: hit.object,
            };
          }
        }
      }
    }
    return null;
  }
}
