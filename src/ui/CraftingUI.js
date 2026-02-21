import blocksData from "../data/blocks.json";

/**
 * クラフト画面（右側パネル）描画
 */
export class CraftingUI {
  /**
   * @param {import('../rendering/TextureAtlas.js').TextureAtlas} textureAtlas
   * @param {import('../inventory/Inventory.js').Inventory} inventory
   * @param {import('../inventory/CraftingSystem.js').CraftingSystem} craftingSystem
   */
  constructor(textureAtlas, inventory, craftingSystem) {
    this.textureAtlas = textureAtlas;
    this.inventory = inventory;
    this.craftingSystem = craftingSystem;
    this._blockNameMap = {};
    blocksData.forEach((b) => (this._blockNameMap[b.id] = b));
  }

  /**
   * レシピリストをレンダリング
   * @param {HTMLElement} container - recipe-list コンテナ
   * @param {function} onCraftDone - クラフト完了コールバック
   */
  render(container, onCraftDone) {
    container.innerHTML = "";
    const statuses = this.craftingSystem.getRecipeStatus();

    statuses.forEach(({ recipe, canCraft }, index) => {
      const recipeEl = document.createElement("div");
      recipeEl.className = "recipe";

      // 左側: アイコン + 名前 + 産出量
      const infoEl = document.createElement("div");
      infoEl.className = "recipe-info";

      const block = this._blockNameMap[recipe.result.id];
      if (block) {
        const iconEl = document.createElement("img");
        iconEl.className = "recipe-icon";
        iconEl.src = this.textureAtlas.getIcon(block.iconTex);
        infoEl.appendChild(iconEl);
      }

      const detailEl = document.createElement("div");
      const nameEl = document.createElement("div");
      nameEl.className = "recipe-name";
      nameEl.textContent = block ? block.name : recipe.result.id;
      detailEl.appendChild(nameEl);

      const yieldEl = document.createElement("div");
      yieldEl.className = "recipe-yield";
      yieldEl.textContent = `× ${recipe.result.count}`;
      detailEl.appendChild(yieldEl);

      infoEl.appendChild(detailEl);
      recipeEl.appendChild(infoEl);

      // 中央: 素材一覧
      const reqsEl = document.createElement("div");
      reqsEl.className = "recipe-reqs";
      for (const itemId in recipe.ingredients) {
        const needed = recipe.ingredients[itemId];
        const has = this.inventory.getCount(itemId);
        const reqEl = document.createElement("div");
        reqEl.className = "req-item " + (has >= needed ? "ok" : "short");

        const iBlock = this._blockNameMap[itemId];
        if (iBlock) {
          const reqIcon = document.createElement("img");
          reqIcon.className = "req-icon";
          reqIcon.src = this.textureAtlas.getIcon(iBlock.iconTex);
          reqEl.appendChild(reqIcon);
        }
        reqEl.appendChild(document.createTextNode(`${has}/${needed}`));
        reqsEl.appendChild(reqEl);
      }
      recipeEl.appendChild(reqsEl);

      // 右側: クラフトボタン
      const craftBtn = document.createElement("button");
      craftBtn.className = "craft-btn";
      craftBtn.textContent = "CRAFT";
      craftBtn.disabled = !canCraft;
      craftBtn.addEventListener("click", () => {
        if (this.craftingSystem.craft(index)) {
          onCraftDone();
        }
      });
      recipeEl.appendChild(craftBtn);

      container.appendChild(recipeEl);
    });
  }
}
