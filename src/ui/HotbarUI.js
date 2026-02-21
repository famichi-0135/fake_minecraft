import { EventBus } from "../core/EventBus.js";

/**
 * ホットバー HUD 描画
 */
export class HotbarUI {
  /**
   * @param {import('../rendering/TextureAtlas.js').TextureAtlas} textureAtlas
   * @param {import('../inventory/Inventory.js').Inventory} inventory
   * @param {import('../inventory/Hotbar.js').Hotbar} hotbar
   */
  constructor(textureAtlas, inventory, hotbar) {
    this.textureAtlas = textureAtlas;
    this.inventory = inventory;
    this.hotbar = hotbar;
    this.el = document.getElementById("toolbar");

    EventBus.on("hotbar:changed", () => this.render());
    EventBus.on("inventory:changed", () => this.render());
  }

  /**
   * ホットバーを描画
   */
  render() {
    this.el.innerHTML = "";
    this.hotbar.slots.forEach((blockId, i) => {
      const slot = document.createElement("div");
      slot.className = "slot" + (i === this.hotbar.activeSlot ? " active" : "");
      const icon = this.textureAtlas.getIcon(blockId);
      if (icon) slot.style.backgroundImage = `url(${icon})`;

      const keyLabel = document.createElement("span");
      keyLabel.className = "slot-key";
      keyLabel.textContent = i === 9 ? "0" : `${i + 1}`;
      slot.appendChild(keyLabel);

      const count = this.inventory.getCount(blockId);
      if (count > 0) {
        const countLabel = document.createElement("span");
        countLabel.className = "count";
        countLabel.textContent = count;
        slot.appendChild(countLabel);
      }

      slot.addEventListener("click", () => {
        EventBus.emit("slot:selected", { index: i });
      });

      this.el.appendChild(slot);
    });
  }
}
