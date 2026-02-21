import blocksData from "../data/blocks.json";
import { EventBus } from "../core/EventBus.js";

/**
 * 所持アイテム管理
 */
export class Inventory {
  constructor() {
    /** @type {Object<string, number>} */
    this.items = {};
    blocksData.forEach((block) => {
      this.items[block.id] = 0;
    });
  }

  /**
   * アイテムを追加
   * @param {string} type
   * @param {number} count
   */
  add(type, count = 1) {
    if (this.items[type] !== undefined) {
      this.items[type] += count;
      EventBus.emit("inventory:changed", { inventory: this.items });
    }
  }

  /**
   * アイテムを消費
   * @param {string} type
   * @param {number} count
   * @returns {boolean} 消費成功
   */
  consume(type, count = 1) {
    if (this.items[type] !== undefined && this.items[type] >= count) {
      this.items[type] -= count;
      EventBus.emit("inventory:changed", { inventory: this.items });
      return true;
    }
    return false;
  }

  /**
   * 指定アイテムの所持数を取得
   * @param {string} type
   * @returns {number}
   */
  getCount(type) {
    return this.items[type] || 0;
  }

  /**
   * 全インベントリデータを取得
   * @returns {Object<string, number>}
   */
  getAll() {
    return this.items;
  }

  /**
   * セーブデータから復元
   * @param {Object<string, number>} data
   */
  loadFrom(data) {
    if (data) {
      Object.assign(this.items, data);
    }
  }
}
