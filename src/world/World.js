import * as THREE from "three";
import { CHUNK_SIZE, RENDER_DISTANCE, BOTTOM_Y } from "../core/Constants.js";
import { Chunk } from "./Chunk.js";
import { TerrainGenerator } from "./TerrainGenerator.js";
import { ChunkWorkerPool } from "./ChunkWorkerPool.js";

/**
 * ワールド管理 — チャンクの生成・破棄・ブロック検索
 */
export class World {
  /**
   * @param {THREE.Scene} scene
   * @param {import('../rendering/MaterialFactory.js').MaterialFactory} materialFactory
   * @param {import('../rendering/TextureAtlas.js').TextureAtlas} textureAtlas
   * @param {import('./BlockRegistry.js').BlockRegistry} blockRegistry
   * @param {Object} modifiedBlocks - セーブデータから復元したブロック変更差分
   */
  constructor(
    scene,
    materialFactory,
    textureAtlas,
    blockRegistry,
    modifiedBlocks,
    seed,
  ) {
    this.scene = scene;
    this.materialFactory = materialFactory;
    this.textureAtlas = textureAtlas;
    this.blockRegistry = blockRegistry;
    this.modifiedBlocks = modifiedBlocks;

    // 既存のメインスレッド用（破壊・設置の再構築で使用）
    this.terrainGenerator = new TerrainGenerator();

    // 非同期チャンク生成用WorkerPool (UV情報を渡す)
    this.workerPool = new ChunkWorkerPool(
      materialFactory,
      textureAtlas.getUVMap(),
      seed,
    );

    /** @type {Map<string, Chunk>} */
    this.chunks = new Map();
    this.lastChunkX = null;
    this.lastChunkZ = null;

    // GPU転送負荷分散用の待機キュー
    this.uploadQueue = [];

    // 松明光源管理 (key: "x,y,z" => THREE.PointLight)
    this.torchLights = new Map();
  }

  /**
   * 毎フレーム呼ばれる更新処理
   * @param {number} delta
   */
  update(delta) {
    // 1フレームあたり最大2つのメッシュをGPUにアップロード(sceneに追加)する
    const UPLOADS_PER_FRAME = 2;
    for (let i = 0; i < UPLOADS_PER_FRAME && this.uploadQueue.length > 0; i++) {
      const task = this.uploadQueue.shift();
      if (task.type === "add") {
        this.scene.add(task.mesh);
      } else if (task.type === "replace") {
        if (task.oldMesh) {
          this.scene.remove(task.oldMesh);
          task.oldMesh.geometry.dispose();
        }
        this.scene.add(task.newMesh);
        task.chunk._isRebuilding = false;
      }
    }
  }

  /**
   * Worker通信用の最適化：対象チャンクとその周囲1チャンクのmodifiedBlocksだけをシリアライズして渡す
   * @param {number} cx
   * @param {number} cz
   * @returns {Object}
   */
  _getRelevantModifiedBlocks(cx, cz) {
    const relevant = {};
    for (const key in this.modifiedBlocks) {
      if (!this.modifiedBlocks.hasOwnProperty(key)) continue;

      // keyは "x,y,z"
      const parts = key.split(",");
      if (parts.length < 3) continue;

      const wx = parseInt(parts[0], 10);
      const wz = parseInt(parts[2], 10);

      const bcx = Math.floor(wx / CHUNK_SIZE);
      const bcz = Math.floor(wz / CHUNK_SIZE);

      // 自身または隣接8チャンク内の変更であれば必要
      if (Math.abs(bcx - cx) <= 1 && Math.abs(bcz - cz) <= 1) {
        relevant[key] = this.modifiedBlocks[key];
      }
    }
    return relevant;
  }

  /**
   * ブロックが格納されている Uint8Array 上のインデックスを計算する
   * @param {number} lx チャンク内ローカル X(0~15)
   * @param {number} ly チャンク内ローカル Y(0~255)
   * @param {number} lz チャンク内ローカル Z(0~15)
   * @returns {number} インデックス (-1: 範囲外)
   */
  _getBlockIndex(lx, ly, lz) {
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
   * プレイヤー位置に基づいてチャンクをロード/アンロード
   * @param {number} playerChunkX
   * @param {number} playerChunkZ
   */
  updateChunks(playerChunkX, playerChunkZ) {
    if (playerChunkX === this.lastChunkX && playerChunkZ === this.lastChunkZ)
      return;

    const neededChunks = new Map(); // key -> lod
    for (let x = -RENDER_DISTANCE; x <= RENDER_DISTANCE; x++) {
      for (let z = -RENDER_DISTANCE; z <= RENDER_DISTANCE; z++) {
        // チェビシェフ距離でLODを判定
        const dist = Math.max(Math.abs(x), Math.abs(z));
        let lod = 0;
        if (dist > 6)
          lod = 2; // 遠景 (低詳細)
        else if (dist > 3) lod = 1; // 中景 (中詳細)

        neededChunks.set(`${playerChunkX + x},${playerChunkZ + z}`, lod);
      }
    }

    // 不要チャンクを破棄
    for (const [key, chunk] of this.chunks.entries()) {
      if (!neededChunks.has(key)) {
        chunk.dispose(this.scene);
        this.chunks.delete(key);
      }
    }

    // 新規チャンク生成 または 既存チャンクのLOD更新
    for (const [key, targetLod] of neededChunks.entries()) {
      const [cx, cz] = key.split(",").map(Number);
      const existingChunk = this.chunks.get(key);

      if (!existingChunk) {
        // 新規作成
        this._generateChunkAsync(cx, cz, targetLod);
      } else if (
        existingChunk.lod !== targetLod &&
        !existingChunk._isRebuilding
      ) {
        // LODが変わった場合は再構築 (Workerで非同期)
        this._rebuildChunkAsync(existingChunk, targetLod);
      }
    }

    this.lastChunkX = playerChunkX;
    this.lastChunkZ = playerChunkZ;
  }

  /**
   * ワールド座標のブロックタイプを取得（当たり判定用、水は通過可能）
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {string|null}
   */
  getSolidBlockType(x, y, z) {
    const key = `${x},${y},${z}`;
    if (this.modifiedBlocks[key] === "air") return null;
    if (this.modifiedBlocks[key]) {
      return this.modifiedBlocks[key] === "water"
        ? null
        : this.modifiedBlocks[key];
    }
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.chunks.get(`${cx},${cz}`);
    if (chunk && chunk.blockData) {
      // flat Uint8Array
      const idx = this._getBlockIndex(
        x - cx * CHUNK_SIZE,
        y - BOTTOM_Y,
        z - cz * CHUNK_SIZE,
      );
      if (idx !== -1) {
        const intType = chunk.blockData[idx];
        const type = this.blockRegistry.getBlockName(intType);
        if (type && type !== "air" && type !== "water") return type;
      }
      return null;
    }
    if (y < -50) return null;
    return "stone";
  }

  /**
   * 指定座標のブロック型を返す（水を含む全ブロック）
   * 水中判定など、水も検出したい場合はこちらを使用
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {string|null}
   */
  getBlockTypeAt(x, y, z) {
    const key = `${x},${y},${z}`;
    if (this.modifiedBlocks[key] !== undefined) {
      return this.modifiedBlocks[key] === "air"
        ? null
        : this.modifiedBlocks[key];
    }
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.chunks.get(`${cx},${cz}`);
    if (chunk && chunk.blockData) {
      const idx = this._getBlockIndex(
        x - cx * CHUNK_SIZE,
        y - BOTTOM_Y,
        z - cz * CHUNK_SIZE,
      );
      if (idx !== -1) {
        const intType = chunk.blockData[idx];
        const type = this.blockRegistry.getBlockName(intType);
        if (type && type !== "air") return type;
      }
      return null;
    }
    return null;
  }

  /**
   * 指定したチャンクがメッシュ構築済みか判定
   * @param {number} cx
   * @param {number} cz
   * @returns {boolean}
   */
  isChunkLoaded(cx, cz) {
    const chunk = this.chunks.get(`${cx},${cz}`);
    // chunkが存在し、かつメッシュが作成されていれば準備完了
    return chunk ? chunk.mesh !== null : false;
  }

  /**
   * チャンクの Map を取得 (Raycaster 等で使用)
   * @returns {Map<string, Chunk>}
   */
  getChunks() {
    return this.chunks;
  }

  /**
   * ブロック破棄後に隣接ブロックを露出させる必要は、
   * Greedy Meshing (ChunkMeshBuilder) ではチャンク全体のリビルドを行うため不要になりますが、
   * 今回は破壊・設置のたびにチャンクを再構築する方針に変更します。
   */

  /**
   * ブロックを破壊する（チャンク再構築 + データ更新）
   * Raycasterからは meshObj(チャンクのMesh) と voxelData が渡されるよう修正しています。
   * (実際の引数は Raycaster の結果オブジェクト)
   * @param {Object} hitResult
   * @returns {{ pos: THREE.Vector3, type: string }|null}
   */
  destroyBlock(hitResult) {
    // 古いインターフェースと新しいインターフェースの両方に対応
    let pos, type, bKey, chunkMesh;

    if (hitResult.chunkMesh) {
      // BufferGeometry (Raycasterで構築した疑似オブジェクト経由)
      pos = hitResult.object.position;
      type = hitResult.object.userData.type;
      chunkMesh = hitResult.chunkMesh;
    } else {
      return null; // 古い Mesh 方式は今回はサポート外
    }

    bKey = `${pos.x},${pos.y},${pos.z}`;
    if (!type || type === "water") return null;

    // データ更新
    this.modifiedBlocks[bKey] = "air";

    // 松明の光源を除去
    if (type === "torch") {
      this._removeTorchLight(bKey);
    }

    // 該当するチャンクを探す
    const cx = Math.floor(pos.x / CHUNK_SIZE);
    const cz = Math.floor(pos.z / CHUNK_SIZE);
    const chunk = this.chunks.get(`${cx},${cz}`);
    if (chunk && chunk.blockData) {
      const idx = this._getBlockIndex(
        pos.x - cx * CHUNK_SIZE,
        pos.y - BOTTOM_Y,
        pos.z - cz * CHUNK_SIZE,
      );
      if (idx !== -1) {
        chunk.blockData[idx] = 0; // air
      }
      // チャンク再構築
      this._rebuildChunkAsync(chunk, 0); // 近景なので LOD 0

      // 隣接したチャンクの境界ブロックだった場合、隣のチャンクも再構築が必要
      this._rebuildNeighborChunksIfNeeded(pos.x, pos.z, cx, cz);
    }

    return { pos: pos.clone(), type };
  }

  /**
   * 松明の光源を除去する
   * @param {string} key "x,y,z"
   */
  _removeTorchLight(key) {
    const light = this.torchLights.get(key);
    if (light) {
      this.scene.remove(light);
      this.torchLights.delete(key);
    }
  }

  /**
   * 松明の光源を追加する
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
  _addTorchLight(x, y, z) {
    const key = `${x},${y},${z}`;
    // 既に存在する場合は作らない
    if (this.torchLights.has(key)) return;
    const light = new THREE.PointLight(0xffaa44, 1.5, 12);
    light.position.set(x, y + 0.5, z);
    this.scene.add(light);
    this.torchLights.set(key, light);
  }

  /**
   * ブロックを設置する
   * @param {THREE.Vector3} voxelPos
   * @param {string} blockType
   * @returns {boolean} 設置成功
   */
  placeBlock(voxelPos, blockType) {
    const key = `${voxelPos.x},${voxelPos.y},${voxelPos.z}`;
    this.modifiedBlocks[key] = blockType;

    const cx = Math.floor(voxelPos.x / CHUNK_SIZE);
    const cz = Math.floor(voxelPos.z / CHUNK_SIZE);
    const chunk = this.chunks.get(`${cx},${cz}`);
    if (chunk && chunk.blockData) {
      const idx = this._getBlockIndex(
        voxelPos.x - cx * CHUNK_SIZE,
        voxelPos.y - BOTTOM_Y,
        voxelPos.z - cz * CHUNK_SIZE,
      );
      if (idx !== -1) {
        chunk.blockData[idx] = this.blockRegistry.getBlockIntId(blockType);
      }
      if (voxelPos.y > chunk.maxY) chunk.maxY = voxelPos.y;
      // チャンク再構築
      this._rebuildChunkAsync(chunk, 0); // 近景のため LOD 0

      // 隣接チャンクの再構築判定
      this._rebuildNeighborChunksIfNeeded(voxelPos.x, voxelPos.z, cx, cz);
    }

    // 松明の光源を追加
    if (blockType === "torch") {
      this._addTorchLight(voxelPos.x, voxelPos.y, voxelPos.z);
    }

    return true;
  }

  /**
   * 境界ブロックの変更の場合に隣のチャンクも再構築する
   */
  _rebuildNeighborChunksIfNeeded(wx, wz, cx, cz) {
    const localX = wx - cx * CHUNK_SIZE;
    const localZ = wz - cz * CHUNK_SIZE;

    if (localX === 0) this._rebuildChunkSafe(cx - 1, cz);
    if (localX === CHUNK_SIZE - 1) this._rebuildChunkSafe(cx + 1, cz);
    if (localZ === 0) this._rebuildChunkSafe(cx, cz - 1);
    if (localZ === CHUNK_SIZE - 1) this._rebuildChunkSafe(cx, cz + 1);
  }

  _rebuildChunkSafe(cx, cz) {
    const chunk = this.chunks.get(`${cx},${cz}`);
    if (chunk) {
      this._rebuildChunkAsync(chunk, chunk.lod);
    }
  }

  // --- 内部 ---

  _generateChunkAsync(cx, cz, lod) {
    // 仮のチャンクオブジェクト（あとでWorkerから受け取ったデータをセットする）
    // Sceneにはまだ追加しない
    const chunk = new Chunk(cx, cz, this.materialFactory, this.blockRegistry);
    chunk.lod = lod;
    this.chunks.set(`${cx},${cz}`, chunk);

    // 非同期生成の依頼
    const relevantMods = this._getRelevantModifiedBlocks(cx, cz);
    this.workerPool.generateChunk(
      cx,
      cz,
      lod,
      relevantMods,
      (geometry, materials, blockDataMap, maxY) => {
        // ユーザー変更分を含めて、ワーカー側のブロックデータをメインにマージ
        chunk.blockData = blockDataMap;
        chunk.maxY = maxY;

        // GeometryとMaterialをMeshに
        if (geometry.getIndex() !== null && geometry.getIndex().count > 0) {
          chunk.mesh = new THREE.Mesh(geometry, materials);
          chunk.mesh.userData = { isChunkMesh: true, chunk: chunk };
          // すぐに追加せずキューに入れる
          this.uploadQueue.push({ type: "add", mesh: chunk.mesh });
        } else {
          geometry.dispose();
        }
      },
    );
  }

  _rebuildChunkAsync(chunk, newLod) {
    chunk._isRebuilding = true;

    const relevantMods = this._getRelevantModifiedBlocks(chunk.cx, chunk.cz);
    this.workerPool.generateChunk(
      chunk.cx,
      chunk.cz,
      newLod,
      relevantMods,
      (geometry, materials, blockDataMap, maxY) => {
        chunk.lod = newLod;
        chunk.blockData = blockDataMap;
        chunk.maxY = maxY;

        if (geometry.getIndex() !== null && geometry.getIndex().count > 0) {
          const oldMesh = chunk.mesh;

          chunk.mesh = new THREE.Mesh(geometry, materials);
          chunk.mesh.userData = { isChunkMesh: true, chunk: chunk };

          // 非同期で入れ替え
          this.uploadQueue.push({
            type: "replace",
            chunk: chunk,
            oldMesh: oldMesh,
            newMesh: chunk.mesh,
          });
        } else {
          // コンテンツが空になった場合
          if (chunk.mesh) {
            this.scene.remove(chunk.mesh);
            chunk.mesh.geometry.dispose();
            chunk.mesh = null;
          }
          geometry.dispose();
          chunk._isRebuilding = false;
        }
      },
    );
  }
}
