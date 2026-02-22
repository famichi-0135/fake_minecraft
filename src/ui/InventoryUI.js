import { EventBus } from "../core/EventBus.js";

/**
 * インベントリ画面（左側パネル）描画
 * 大量アイテム対応版（タブ・検索・ページネーション）
 */
export class InventoryUI {
  constructor(textureAtlas, inventory, hotbar, blockRegistry) {
    this.textureAtlas = textureAtlas;
    this.inventory = inventory;
    this.hotbar = hotbar;
    this.blockRegistry = blockRegistry;

    this.currentCategory = "all";
    this.searchQuery = "";
    this.currentPage = 0;
    this.itemsPerPage = 42; // 7列 x 6段想定

    this.isInitialized = false;
  }

  /**
   * インベントリグリッドとホットバー設定をレンダリング
   * @param {HTMLElement} invGridEl  - インベントリグリッドのコンテナ
   * @param {HTMLElement} hotbarGridEl - ホットバー設定グリッドのコンテナ
   */
  render(invGridEl, hotbarGridEl) {
    if (!this.isInitialized) {
      this._initControls(invGridEl);
      this.isInitialized = true;
    }
    this._renderInventoryGrid();
    this._renderHotbarGrid(hotbarGridEl);
  }

  /**
   * 初回のみ：カテゴリタブと検索バーなどのコントロールを構築する
   * @param {HTMLElement} container
   */
  _initControls(container) {
    // コンテナの親要素 (inv-section) にコントロール群を差し込む
    const parent = container.parentElement;

    // ヘッダーの上にコントロール用DOMを生成
    this.controlsContainer = document.createElement("div");
    this.controlsContainer.className = "inv-controls";

    // タブバー
    this.tabsEl = document.createElement("div");
    this.tabsEl.className = "inv-tabs";
    const categories = [
      { id: "all", label: "すべて" },
      { id: "building", label: "建築" },
      { id: "nature", label: "自然" },
      { id: "materials", label: "素材" },
      { id: "tools", label: "ツール" },
      { id: "misc", label: "その他" },
    ];
    categories.forEach((cat) => {
      const btn = document.createElement("button");
      btn.className = "inv-tab-btn" + (cat.id === "all" ? " active" : "");
      btn.textContent = cat.label;
      btn.dataset.target = cat.id;
      btn.addEventListener("click", () => {
        this.currentCategory = cat.id;
        this.currentPage = 0;
        this._updateTabs();
        this._renderInventoryGrid();
      });
      this.tabsEl.appendChild(btn);
    });

    // 検索バー
    this.searchBox = document.createElement("input");
    this.searchBox.type = "text";
    this.searchBox.className = "inv-search-box";
    this.searchBox.placeholder = "名前で検索...";
    this.searchBox.addEventListener("input", (e) => {
      this.searchQuery = e.target.value.trim();
      this.currentPage = 0;
      this._renderInventoryGrid();
    });

    // ページャー
    this.pagerEl = document.createElement("div");
    this.pagerEl.className = "inv-pager";

    const topRow = document.createElement("div");
    topRow.className = "inv-controls-row";
    topRow.appendChild(this.tabsEl);

    const bottomRow = document.createElement("div");
    bottomRow.className = "inv-controls-row";
    bottomRow.appendChild(this.searchBox);
    bottomRow.appendChild(this.pagerEl);

    this.controlsContainer.appendChild(topRow);
    this.controlsContainer.appendChild(bottomRow);

    // 既存の container (inventory-grid) のすぐ上に挿入
    parent.insertBefore(this.controlsContainer, container);
    this.gridContainer = container; // あとで書き換えるため保存
  }

  _updateTabs() {
    [...this.tabsEl.children].forEach((btn) => {
      if (btn.dataset.target === this.currentCategory) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  _renderInventoryGrid() {
    this.gridContainer.innerHTML = "";

    // 1. レジストリからデータをフィルタリング
    const filteredBlocks = this.blockRegistry.filterBlocks(
      this.currentCategory,
      this.searchQuery,
    );

    // 2. ページネーション計算
    const totalItems = filteredBlocks.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / this.itemsPerPage));
    if (this.currentPage >= totalPages) {
      this.currentPage = totalPages - 1;
    }

    const startIndex = this.currentPage * this.itemsPerPage;
    const pageItems = filteredBlocks.slice(
      startIndex,
      startIndex + this.itemsPerPage,
    );

    // 3. ページャの再描画
    this._renderPager(totalPages);

    // 4. グリッドの描画
    pageItems.forEach((block) => {
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

      this.gridContainer.appendChild(item);
    });

    // 余った枠をダミーで埋めてレイアウトを崩さないようにする（オプション）
    const emptyCount = this.itemsPerPage - pageItems.length;
    for (let i = 0; i < emptyCount; i++) {
      const dummy = document.createElement("div");
      dummy.className = "inv-item dummy";
      dummy.style.visibility = "hidden";
      this.gridContainer.appendChild(dummy);
    }
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
        this._renderInventoryGrid();
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
        this._renderInventoryGrid();
      }
    });

    this.pagerEl.appendChild(btnPrev);
    this.pagerEl.appendChild(label);
    this.pagerEl.appendChild(btnNext);
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
