import blocksData from "../data/blocks.json";

/**
 * クラフト画面（右側パネル）描画
 * 大量レシピ対応版（作成可能フィルタ・ページネーション付）
 */
export class CraftingUI {
  constructor(textureAtlas, inventory, craftingSystem, blockRegistry) {
    this.textureAtlas = textureAtlas;
    this.inventory = inventory;
    this.craftingSystem = craftingSystem;
    this.blockRegistry = blockRegistry; // 統合のため追加

    this._blockNameMap = {};
    blocksData.forEach((b) => (this._blockNameMap[b.id] = b));

    this.showCraftableOnly = false;
    this.currentPage = 0;
    this.itemsPerPage = 20;

    this.isInitialized = false;
  }

  /**
   * レシピリストをレンダリング
   * @param {HTMLElement} container - recipe-list コンテナ
   * @param {function} onCraftDone - クラフト完了コールバック
   */
  render(container, onCraftDone) {
    if (!this.isInitialized) {
      this._initControls(container);
      this.isInitialized = true;
    }
    this._onCraftDone = onCraftDone;
    this._renderRecipeList();
  }

  _initControls(container) {
    const parent = container.parentElement;

    this.controlsContainer = document.createElement("div");
    this.controlsContainer.className = "inv-controls";

    const topRow = document.createElement("div");
    topRow.className = "inv-controls-row";

    // クラフト可能のみ表示チェックボックス
    const toggleLabel = document.createElement("label");
    toggleLabel.className = "craft-toggle-label";
    toggleLabel.style.color = "#fff";
    toggleLabel.style.fontSize = "12px";
    toggleLabel.style.cursor = "pointer";
    toggleLabel.style.display = "flex";
    toggleLabel.style.alignItems = "center";
    toggleLabel.style.gap = "6px";

    const toggleCheckbox = document.createElement("input");
    toggleCheckbox.type = "checkbox";
    toggleCheckbox.checked = this.showCraftableOnly;
    toggleCheckbox.addEventListener("change", (e) => {
      this.showCraftableOnly = e.target.checked;
      this.currentPage = 0; // ページリセット
      this._renderRecipeList();
    });

    toggleLabel.appendChild(toggleCheckbox);
    toggleLabel.appendChild(document.createTextNode("作れるものだけ表示"));

    // ページャー
    this.pagerEl = document.createElement("div");
    this.pagerEl.className = "inv-pager";

    topRow.appendChild(toggleLabel);
    topRow.appendChild(this.pagerEl);

    this.controlsContainer.appendChild(topRow);

    parent.insertBefore(this.controlsContainer, container);
    this.listContainer = container;
  }

  _renderRecipeList() {
    this.listContainer.innerHTML = "";

    // 全レシピの状態を取得
    let statuses = this.craftingSystem.getRecipeStatus();

    // 抽出（フィルタリング）
    if (this.showCraftableOnly) {
      statuses = statuses.filter((s) => s.canCraft);
    }

    // ページネーション計算
    const totalItems = statuses.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / this.itemsPerPage));
    if (this.currentPage >= totalPages) {
      this.currentPage = totalPages - 1;
    }

    const startIndex = this.currentPage * this.itemsPerPage;
    const pageItems = statuses.slice(
      startIndex,
      startIndex + this.itemsPerPage,
    );

    // ページャ描画
    this._renderPager(totalPages);

    // リスト描画
    pageItems.forEach((statusObj) => {
      // 実際のインデックス（craftingSystem内でのインデックス）を渡す必要がある
      // ここでは statusObj 自身が元のインデックスを持っていると仮定するか、indexOf等で探すか。
      // もし `getRecipeStatus` が originalIndex を返さない場合、ここでは全レシピ配列と突合する。
      // 最善は `getRecipeStatus` の返り値に index を含ませることだが、現状は下記のように対処する。
      const rawIndex = this.craftingSystem
        .getRecipeStatus()
        .findIndex((s) => s.recipe === statusObj.recipe);

      const { recipe, canCraft } = statusObj;

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
        if (this.craftingSystem.craft(rawIndex)) {
          if (this._onCraftDone) this._onCraftDone();
          // クリック直後に現在のレシピリストを即座に再評価して書き換える
          this._renderRecipeList();
        }
      });
      recipeEl.appendChild(craftBtn);

      this.listContainer.appendChild(recipeEl);
    });
  }

  _renderPager(totalPages) {
    this.pagerEl.innerHTML = "";

    const btnPrev = document.createElement("button");
    btnPrev.className = "pager-btn";
    btnPrev.textContent = "◀";
    btnPrev.disabled = this.currentPage === 0;
    btnPrev.addEventListener("click", () => {
      if (this.currentPage > 0) {
        this.currentPage--;
        this._renderRecipeList();
      }
    });

    const label = document.createElement("span");
    label.className = "pager-info";
    label.textContent = `${this.currentPage + 1} / ${totalPages}`;

    const btnNext = document.createElement("button");
    btnNext.className = "pager-btn";
    btnNext.textContent = "▶";
    btnNext.disabled = this.currentPage >= totalPages - 1;
    btnNext.addEventListener("click", () => {
      if (this.currentPage < totalPages - 1) {
        this.currentPage++;
        this._renderRecipeList();
      }
    });

    this.pagerEl.appendChild(btnPrev);
    this.pagerEl.appendChild(label);
    this.pagerEl.appendChild(btnNext);
  }
}
