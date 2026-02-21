import * as THREE from "three";
import { CHUNK_SIZE, BOTTOM_Y } from "../core/Constants.js";
import { ChunkMeshBuilder } from "./ChunkMeshBuilder.js";

/**
 * 単一チャンクのブロックデータ保持・メッシュ構築
 */
export class Chunk {
  /**
   * @param {number} cx - チャンク座標X
   * @param {number} cz - チャンク座標Z
   * @param {import('../rendering/MaterialFactory.js').MaterialFactory} materialFactory
   * @param {import('./BlockRegistry.js').BlockRegistry} blockRegistry
   */
  constructor(cx, cz, materialFactory, blockRegistry) {
    this.cx = cx;
    this.cz = cz;
    this.startX = cx * CHUNK_SIZE;
    this.startZ = cz * CHUNK_SIZE;
    this.materialFactory = materialFactory;
    this.blockRegistry = blockRegistry;

    /** @type {Map<string, string>} ブロックキー → ブロックタイプ */
    this.blockData = new Map();

    /** @type {THREE.Mesh|null} チャンク全体を1つに統合したメッシュ */
    this.mesh = null;

    /** @type {Map<number, Object>} Raycast用のメタデータ (faceIndex ->ブロック情報) */
    this.metaMap = null;

    /** @type {number} チャンク内の最大Y */
    this.maxY = -Infinity;

    /** @type {number} 現在の LOD (Level of Detail) レベル */
    this.lod = 0;
  }

  /**
   * ブロックデータをセット（modifiedBlocks でオーバーライド対応）
   * @param {number} bx
   * @param {number} by
   * @param {number} bz
   * @param {string} type
   * @param {Object} modifiedBlocks
   */
  setBlock(bx, by, bz, type, modifiedBlocks) {
    const key = `${bx},${by},${bz}`;
    if (modifiedBlocks[key] !== undefined) {
      type = modifiedBlocks[key];
    }
    if (type !== "air") {
      this.blockData.set(key, type);
      if (by > this.maxY) this.maxY = by;
    } else {
      this.blockData.delete(key);
    }
  }

  /**
   * modifiedBlocks からこのチャンク範囲のデータを上書き適用
   * @param {Object} modifiedBlocks
   */
  applyModifiedBlocks(modifiedBlocks) {
    for (const bKey in modifiedBlocks) {
      const [bx, by, bz] = bKey.split(",").map(Number);
      if (
        bx >= this.startX &&
        bx < this.startX + CHUNK_SIZE &&
        bz >= this.startZ &&
        bz < this.startZ + CHUNK_SIZE
      ) {
        const type = modifiedBlocks[bKey];
        if (type !== "air") {
          this.blockData.set(bKey, type);
          if (by > this.maxY) this.maxY = by;
        } else {
          this.blockData.delete(bKey);
        }
      }
    }
  }

  /**
   * メッシュを構築してシーンに追加する (ChunkMeshBuilder を使用)
   * @param {THREE.Scene} scene
   */
  buildMeshes(scene) {
    this.dispose(scene);

    if (this.blockData.size === 0) return;

    const builder = new ChunkMeshBuilder(
      this,
      this.materialFactory,
      this.blockRegistry,
    );
    const { geometry, materials, metaMap } = builder.build();

    if (geometry.getIndex().count === 0) {
      geometry.dispose();
      return;
    }

    this.mesh = new THREE.Mesh(geometry, materials);
    // チャンク専用のuserDataを付与 (Raycaster側でChunk自身を特定するため)
    this.mesh.userData = { isChunkMesh: true, chunk: this };
    scene.add(this.mesh);
    this.metaMap = metaMap;
  }

  /**
   * メッシュをシーンから除去してクリーンアップ
   * @param {THREE.Scene} scene
   */
  dispose(scene) {
    if (this.mesh) {
      scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      // materialは共有されているのでdisposeしない
      this.mesh = null;
      this.metaMap = null;
    }
  }
}
