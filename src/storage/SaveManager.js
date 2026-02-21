import { SAVE_KEY } from "../core/Constants.js";
import { EventBus } from "../core/EventBus.js";

/**
 * localStorage セーブ / ロード / リセット
 */
export class SaveManager {
  constructor() {
    // セーブイベント購読
    EventBus.on("world:save", () => this._debouncedSave());
    EventBus.on("world:reset", () => this.reset());

    this._saveTimer = null;
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
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn("SaveManager: failed to load", e);
    }
    return null;
  }

  /**
   * セーブ実行
   */
  save() {
    if (!this.refs) return;
    try {
      const data = {
        blocks: this.refs.modifiedBlocks,
        inventory: this.refs.inventory.getAll(),
        hotbar: this.refs.hotbar.slots,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("SaveManager: failed to save", e);
    }
  }

  /**
   * セーブデータを削除してリロード
   */
  reset() {
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  }

  // デバウンス付きセーブ（連続操作時の性能保護）
  _debouncedSave() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this.save(), 200);
  }
}
