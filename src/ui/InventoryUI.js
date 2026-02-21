import blocksData from "../data/blocks.json";
import { EventBus } from "../core/EventBus.js";

/**
 * インベントリ画面（左側パネル）描画
 */
export class InventoryUI {
  /**
   * @param {import('../rendering/TextureAtlas.js').TextureAtlas} textureAtlas
   * @param {import('../inventory/Inventory.js').Inventory} inventory
   * @param {import('../inventory/Hotbar.js').Hotbar} hotbar
   */
  constructor(textureAtlas, inventory, hotbar) {
    this.textureAtlas = textureAtlas;
    this.inventory = inventory;
    this.hotbar = hotbar;
  }

  /**
   * インベントリグリッドとホットバー設定をレンダリング
   * @param {HTMLElement} invGridEl  - インベントリグリッドのコンテナ
   * @param {HTMLElement} hotbarGridEl - ホットバー設定グリッドのコンテナ
   */
  render(invGridEl, hotbarGridEl) {
    this._renderInventoryGrid(invGridEl);
    this._renderHotbarGrid(hotbarGridEl);
  }

  _renderInventoryGrid(container) {
    container.innerHTML = "";
    blocksData.forEach((block) => {
      const count = this.inventory.getCount(block.id);
      const item = document.createElement("div");
      item.className = "inv-item" + (count === 0 ? " empty" : "");
      item.draggable = count > 0;
      item.dataset.blockId = block.id;

      const icon = document.createElement("div");
      icon.className = "inv-item-icon";
      const iconUrl = this.textureAtlas.getIcon(block.iconTex);
      if (iconUrl) icon.style.backgroundImage = `url(${iconUrl})`;
      item.appendChild(icon);

      const nameEl = document.createElement("div");
      nameEl.className = "inv-item-name";
      nameEl.textContent = block.name;
      item.appendChild(nameEl);

      if (count > 0) {
        const countEl = document.createElement("div");
        countEl.className = "inv-item-count";
        countEl.textContent = count;
        item.appendChild(countEl);
      }

      // ドラッグ開始
      item.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", block.id);
      });

      container.appendChild(item);
    });
  }

  _renderHotbarGrid(container) {
    container.innerHTML = "";
    this.hotbar.slots.forEach((slotId, i) => {
      const slot = document.createElement("div");
      slot.className = "hotbar-slot-ui";

      const keyLabel = document.createElement("div");
      keyLabel.className = "slot-key";
      keyLabel.textContent = i === 9 ? "0" : `${i + 1}`;
      slot.appendChild(keyLabel);

      if (slotId) {
        const icon = document.createElement("div");
        icon.className = "inv-item-icon";
        const iconUrl = this.textureAtlas.getIcon(slotId);
        if (iconUrl) icon.style.backgroundImage = `url(${iconUrl})`;
        slot.appendChild(icon);
      }

      // D&D ドロップ受付
      slot.addEventListener("dragover", (e) => {
        e.preventDefault();
        slot.classList.add("drag-over");
      });
      slot.addEventListener("dragleave", () => {
        slot.classList.remove("drag-over");
      });
      slot.addEventListener("drop", (e) => {
        e.preventDefault();
        slot.classList.remove("drag-over");
        const blockId = e.dataTransfer.getData("text/plain");
        if (blockId) {
          this.hotbar.setSlot(i, blockId);
          EventBus.emit("world:save");
        }
      });

      container.appendChild(slot);
    });
  }
}
