import { DEFAULT_HOTBAR } from "../core/Constants.js";
import { EventBus } from "../core/EventBus.js";

/**
 * ホットバー状態管理 (10スロット)
 */
export class Hotbar {
  /**
   * @param {import('./Inventory.js').Inventory} inventory
   */
  constructor(inventory) {
    this.inventory = inventory;
    /** @type {string[]} */
    this.slots = [...DEFAULT_HOTBAR];
    /** @type {number} */
    this.activeSlot = 0;

    // イベント購読
    EventBus.on("slot:selected", ({ index }) => this.selectSlot(index));
    EventBus.on("slot:scroll", ({ direction }) => {
      this.selectSlot((this.activeSlot + direction + 10) % 10);
    });

    // BlockAction からの問い合わせに応答
    EventBus.on("hotbar:query-selected", ({ callback }) => {
      const type = this.slots[this.activeSlot];
      const count = type ? this.inventory.getCount(type) : 0;
      callback(type, count);
    });
  }

  /**
   * スロットを選択
   * @param {number} index
   */
  selectSlot(index) {
    this.activeSlot = index;
    EventBus.emit("hotbar:changed", {
      slots: this.slots,
      active: this.activeSlot,
    });
  }

  /**
   * スロットにアイテムをセット
   * @param {number} index
   * @param {string} itemId
   */
  setSlot(index, itemId) {
    this.slots[index] = itemId;
    EventBus.emit("hotbar:changed", {
      slots: this.slots,
      active: this.activeSlot,
    });
  }

  /**
   * 選択中のアイテムタイプを取得
   * @returns {string|null}
   */
  getSelectedType() {
    return this.slots[this.activeSlot] || null;
  }

  /**
   * セーブデータから復元
   * @param {string[]} data
   */
  loadFrom(data) {
    if (data && Array.isArray(data)) {
      this.slots = data;
    }
  }
}
