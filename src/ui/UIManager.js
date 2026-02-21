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
   * @param {import('./MapUI.js').MapUI} mapUI
   */
  constructor(pauseScreen, hotbarUI, inventoryUI, craftingUI, mapUI) {
    this.pauseScreen = pauseScreen;
    this.hotbarUI = hotbarUI;
    this.inventoryUI = inventoryUI;
    this.craftingUI = craftingUI;
    this.mapUI = mapUI;

    this.inventoryEl = document.getElementById("inventory-ui");
    this.invGridEl = document.querySelector(".inventory-grid");
    this.hotbarGridEl = document.querySelector(".hotbar-grid");
    this.recipeListEl = document.querySelector(".recipe-list");
    this.mapEl = null; // 動的に作成されるため初回表示時に取得

    /** @type {boolean} */
    this.inventoryOpen = false;
    this.mapOpen = false;

    // インベントリ開閉
    EventBus.on("input:toggle-inventory", () => this.toggleInventory());
    // マップ開閉
    EventBus.on("input:toggle-map", () => this.toggleMap());
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
    if (this.mapOpen) return; // マップが開いている時は無視

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

  /**
   * マップ画面のトグル
   */
  toggleMap() {
    if (!this.pauseScreen.getIsLocked() && !this.mapOpen) return;
    if (this.inventoryOpen) return; // インベントリが開いている時は無視

    this.mapOpen = !this.mapOpen;

    if (this.mapOpen) {
      if (!this.mapEl) this.mapEl = document.getElementById("map-ui");
      this.mapEl.style.display = "flex";
      this.pauseScreen.pauseForUI();
      this.mapUI.render();
    } else {
      if (this.mapEl) this.mapEl.style.display = "none";
      this.pauseScreen.resumeFromUI();
    }
  }

  _renderInventory() {
    this.inventoryUI.render(this.invGridEl, this.hotbarGridEl);
    this.craftingUI.render(this.recipeListEl, () => this._renderInventory());
  }
}
