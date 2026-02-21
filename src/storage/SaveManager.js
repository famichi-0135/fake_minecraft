import { WORLDS_LIST_KEY } from "../core/Constants.js";
import { EventBus } from "../core/EventBus.js";

/**
 * localStorage セーブ / ロード / リセット (複数ワールド対応)
 */
export class SaveManager {
  constructor() {
    // セーブイベント購読
    EventBus.on("world:save", () => this._debouncedSave());
    EventBus.on("world:reset", () => this.reset());

    this._saveTimer = null;
    this.currentWorldId = null;
    this.currentSeed = null;
  }

  /**
   * 現在のワールドIDを設定する (タイトル画面で使用)
   * @param {string} worldId
   */
  setCurrentWorld(worldId) {
    this.currentWorldId = worldId;
    // ワールドを切り替えた段階でシード情報をリセット
    this.currentSeed = null;
  }

  /**
   * 現在ロードされているシード値を取得する
   * @returns {number|null}
   */
  getSeed() {
    return this.currentSeed;
  }

  /**
   * 保存されているワールドの一覧を取得
   * @returns {string[]} ワールド名(ID)の配列
   */
  listWorlds() {
    try {
      const rawList = localStorage.getItem(WORLDS_LIST_KEY);
      if (rawList) {
        return JSON.parse(rawList);
      }
    } catch (e) {
      console.warn("SaveManager: failed to list worlds", e);
    }
    return [];
  }

  /**
   * 新しいワールドを追加（または既存のワールドリストを更新）
   * @param {string} worldId
   */
  _addToWorldList(worldId) {
    const worlds = this.listWorlds();
    if (!worlds.includes(worldId)) {
      worlds.push(worldId);
      localStorage.setItem(WORLDS_LIST_KEY, JSON.stringify(worlds));
    }
  }

  /**
   * 指定したワールドを削除する
   * @param {string} worldId
   */
  deleteWorld(worldId) {
    // セーブデータ本体の削除
    const saveKey = `voxelWorldSave_${worldId}`;
    localStorage.removeItem(saveKey);

    // リストから削除
    const worlds = this.listWorlds();
    const newWorlds = worlds.filter((w) => w !== worldId);
    localStorage.setItem(WORLDS_LIST_KEY, JSON.stringify(newWorlds));
  }

  /**
   * セーブ対象データの参照をセット
   * @param {Object} refs - { modifiedBlocks, inventory, hotbar }
   */
  setRefs(refs) {
    this.refs = refs;
  }

  /**
   * セーブデータのロード
   * @returns {{ blocks: Object, inventory: Object, hotbar: string[] } | null}
   */
  load() {
    if (!this.currentWorldId) return null;

    try {
      const saveKey = `voxelWorldSave_${this.currentWorldId}`;
      const raw = localStorage.getItem(saveKey);
      if (raw) {
        const data = JSON.parse(raw);
        // シード値がない旧セーブデータの場合はランダム生成
        if (data.seed === undefined) {
          data.seed = Math.floor(Math.random() * 2147483647);
          this.currentSeed = data.seed;
          localStorage.setItem(saveKey, JSON.stringify(data));
        } else {
          this.currentSeed = data.seed;
        }
        return data;
      }

      // 新規ワールドの場合はここでランダムなシード値を生成してセット
      this.currentSeed = Math.floor(Math.random() * 2147483647);
      if (this.currentWorldId === "default_world") {
        const fallBackRaw = localStorage.getItem("voxelWorldSave");
        if (fallBackRaw) {
          // マイグレーション
          const data = JSON.parse(fallBackRaw);
          if (data.seed === undefined) {
            data.seed = Math.floor(Math.random() * 2147483647);
          }
          this.currentSeed = data.seed;
          localStorage.setItem(saveKey, JSON.stringify(data));
          this._addToWorldList("default_world");
          return data;
        }
      }
    } catch (e) {
      console.warn("SaveManager: failed to load", e);
    }
    return null;
  }

  /**
   * セーブ実行
   */
  save() {
    if (!this.refs || !this.currentWorldId) return;
    try {
      // 既存データをロードしてマージするか、新規作成時ならシード値を含める
      const existingData = this.load() || {};

      const data = {
        ...existingData,
        blocks: this.refs.modifiedBlocks,
        inventory: this.refs.inventory.getAll(),
        hotbar: this.refs.hotbar.slots,
        seed: this.currentSeed || Math.floor(Math.random() * 2147483647),
      };

      const saveKey = `voxelWorldSave_${this.currentWorldId}`;
      localStorage.setItem(saveKey, JSON.stringify(data));
      this._addToWorldList(this.currentWorldId);
    } catch (e) {
      console.warn("SaveManager: failed to save", e);
    }
  }

  /**
   * 現在のセーブデータを削除してリロード
   */
  reset() {
    if (this.currentWorldId) {
      this.deleteWorld(this.currentWorldId);
    } else {
      localStorage.removeItem("voxelWorldSave");
    }
    location.reload();
  }

  // デバウンス付きセーブ（連続操作時の性能保護）
  _debouncedSave() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this.save(), 200);
  }
}
