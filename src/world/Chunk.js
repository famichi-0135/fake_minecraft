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

    /** @type {Uint8Array} 1次元配列によるブロックデータ (256 * 16 * 16 = 65536 byte) */
    this.blockData = new Uint8Array(256 * CHUNK_SIZE * CHUNK_SIZE);

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
   * ローカル座標から Uint8Array のインデックスを計算する
   * @param {number} lx チャンク内ローカル X(0~15)
   * @param {number} ly チャンク内ローカル Y(0~255)
   * @param {number} lz チャンク内ローカル Z(0~15)
   * @returns {number} インデックス (-1: 範囲外)
   */
  getIndex(lx, ly, lz) {
    if (
      ly < 0 ||
      ly >= 256 ||
      lx < 0 ||
      lx >= CHUNK_SIZE ||
      lz < 0 ||
      lz >= CHUNK_SIZE
    )
      return -1;
    return ly * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx;
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

    const lx = bx - this.startX;
    const lz = bz - this.startZ;
    const ly = by - BOTTOM_Y;
    const idx = this.getIndex(lx, ly, lz);

    if (idx !== -1) {
      if (type !== "air") {
        this.blockData[idx] = this.blockRegistry.getBlockIntId(type);
        if (by > this.maxY) this.maxY = by;
      } else {
        this.blockData[idx] = 0;
      }
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
        const lx = bx - this.startX;
        const lz = bz - this.startZ;
        const ly = by - BOTTOM_Y;
        const idx = this.getIndex(lx, ly, lz);

        if (idx !== -1) {
          if (type !== "air") {
            this.blockData[idx] = this.blockRegistry.getBlockIntId(type);
            if (by > this.maxY) this.maxY = by;
          } else {
            this.blockData[idx] = 0;
          }
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

    if (this.maxY === -Infinity) return;

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
