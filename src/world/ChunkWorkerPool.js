import * as THREE from "three";
import ChunkWorker from "./ChunkWorker?worker";

/**
 * 複数スレッドのWebWorkerプール管理・タスクスケジューリング
 */
export class ChunkWorkerPool {
  /**
   * @param {import('../rendering/MaterialFactory.js').MaterialFactory} materialFactory
   * @param {Object} uvMap - アトラスUVデータ
   */
  constructor(materialFactory, uvMap) {
    this.materialFactory = materialFactory;

    const concurrency = navigator.hardwareConcurrency || 4;
    this.maxWorkers = Math.min(concurrency, 4); // メインスレッド用にも余力を残すために最大4

    /** @type {Worker[]} */
    this.workers = [];
    /** @type {boolean[]} */
    this.workerStatus = []; // true = Busy, false = Free

    /** @type {Array<Object>} 待機中のタスクキュー */
    this.queue = [];

    // Worker初期化
    for (let i = 0; i < this.maxWorkers; i++) {
      const worker = new ChunkWorker();
      worker.postMessage({ type: "init", uvMap });
      worker.onmessage = this.onWorkerMessage.bind(this, i);
      this.workers.push(worker);
      this.workerStatus.push(false);
    }
  }

  /**
   * チャンク生成タスクをキューに追加する
   * @param {number} cx
   * @param {number} cz
   * @param {number} lod - LOD (Level of Detail) レベル
   * @param {Object} modifiedBlocks
   * @param {Function} onComplete - (geometry, materials, blockData, maxY) => void
   */
  generateChunk(cx, cz, lod, modifiedBlocks, onComplete) {
    const task = {
      cx,
      cz,
      lod,
      modifiedBlocksBase: { ...modifiedBlocks },
      onComplete,
    };
    this.queue.push(task);
    this._processQueue();
  }

  _processQueue() {
    if (this.queue.length === 0) return;

    // 空いているWorkerを探す
    for (let i = 0; i < this.maxWorkers; i++) {
      if (!this.workerStatus[i]) {
        if (this.queue.length === 0) break;

        // プレイヤーに近いチャンクから処理するため、将来的にここでキューのソートを入れると良い
        const task = this.queue.shift();
        this.workerStatus[i] = true;

        // タスクとコールバックを紐付け
        this.workers[i].currentTaskCallback = task.onComplete;

        this.workers[i].postMessage({
          cx: task.cx,
          cz: task.cz,
          lod: task.lod,
          modifiedBlocksBase: task.modifiedBlocksBase,
        });
      }
    }
  }

  /**
   * Workerからの結果受け取り
   */
  onWorkerMessage(workerIndex, e) {
    const data = e.data;
    const worker = this.workers[workerIndex];
    const callback = worker.currentTaskCallback;

    if (callback) {
      // 1. ArrayBuffer から THREE.BufferGeometry を復元
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(data.positions, 3),
      );
      geometry.setAttribute(
        "normal",
        new THREE.BufferAttribute(data.normals, 3),
      );
      geometry.setAttribute("uv", new THREE.BufferAttribute(data.uvs, 2));
      geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));

      if (data.boundingSphere) {
        geometry.boundingSphere = new THREE.Sphere(
          new THREE.Vector3(...data.boundingSphere.center),
          data.boundingSphere.radius,
        );
      }

      for (const group of data.groups) {
        geometry.addGroup(group.start, group.count, group.materialIndex);
      }

      // 2. マテリアルの復元
      // アトラスマテリアル [opaque, transparent] をそのまま使う
      const materials = this.materialFactory.getAtlasMaterials();

      // 3. blockDataArray の復元 (ゼロコピー、そのまま流す)
      const blockDataArray = data.blockDataArray;

      callback(geometry, materials, blockDataArray, data.maxY);
    }

    // Workerを解放して次のタスクへ
    worker.currentTaskCallback = null;
    this.workerStatus[workerIndex] = false;
    this._processQueue();
  }
}
