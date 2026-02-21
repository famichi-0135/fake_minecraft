import { EventBus } from "../core/EventBus.js";

/**
 * UI全体の表示切替オーケストレーション
 */
export class UIManager {
  /**
   * @param {import('./PauseScreen.js').PauseScreen} pauseScreen
   * @param {import('./HotbarUI.js').HotbarUI} hotbarUI
   * @param {import('./InventoryUI.js').InventoryUI} inventoryUI
   * @param {import('./CraftingUI.js').CraftingUI} craftingUI
   */
  constructor(pauseScreen, hotbarUI, inventoryUI, craftingUI) {
    this.pauseScreen = pauseScreen;
    this.hotbarUI = hotbarUI;
    this.inventoryUI = inventoryUI;
    this.craftingUI = craftingUI;

    this.inventoryEl = document.getElementById("inventory-ui");
    this.invGridEl = document.querySelector(".inventory-grid");
    this.hotbarGridEl = document.querySelector(".hotbar-grid");
    this.recipeListEl = document.querySelector(".recipe-list");

    /** @type {boolean} */
    this.inventoryOpen = false;

    // インベントリ開閉
    EventBus.on("input:toggle-inventory", () => this.toggleInventory());
  }

  /**
   * フレームごとのUI更新（必要なら）
   */
  update() {
    // 現在は不要、将来の拡張用
  }

  /**
   * インベントリ/クラフト画面のトグル
   */
  toggleInventory() {
    if (!this.pauseScreen.getIsLocked() && !this.inventoryOpen) return;

    this.inventoryOpen = !this.inventoryOpen;

    if (this.inventoryOpen) {
      this.inventoryEl.style.display = "flex";
      this.pauseScreen.pauseForUI();
      this._renderInventory();
    } else {
      this.inventoryEl.style.display = "none";
      this.pauseScreen.resumeFromUI();
    }
  }

  _renderInventory() {
    this.inventoryUI.render(this.invGridEl, this.hotbarGridEl);
    this.craftingUI.render(this.recipeListEl, () => this._renderInventory());
  }
}
