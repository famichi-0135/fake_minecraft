import blocksData from "../data/blocks.json";

/**
 * ブロック定義辞書
 * blocks.json からブロック情報を読み込み、IDで検索する
 */
export class BlockRegistry {
  constructor() {
    /** @type {Array} */
    this.blocks = blocksData;
    /** @type {Map<string, object>} */
    this.byId = new Map();
    /** @type {Set<string>} */
    this.transparentIds = new Set();

    // --- 【Phase 7】 Uint8Array化のための整数IDマッピング ---
    /** @type {Map<string, number>} */
    this.nameToIdMap = new Map();
    /** @type {Map<number, string>} */
    this.idToNameMap = new Map();

    // 0: 空気, 1: 水 (特殊ブロック)
    this.nameToIdMap.set("air", 0);
    this.idToNameMap.set(0, "air");
    this.nameToIdMap.set("water", 1);
    this.idToNameMap.set(1, "water");

    this.blocks.forEach((block, index) => {
      this.byId.set(block.id, block);
      if (block.transparent) {
        this.transparentIds.add(block.id);
      }

      const intId = index + 2; // 2番目以降に格納
      this.nameToIdMap.set(block.id, intId);
      this.idToNameMap.set(intId, block.id);
    });

    // 水は常に半透明 (blocks.json に含まれないが必要)
    this.transparentIds.add("water");
  }

  /**
   * 文字列IDから整数IDを取得
   * @param {string} name
   * @returns {number}
   */
  getBlockIntId(name) {
    return this.nameToIdMap.get(name) || 0; // 見つからなければ 0(空気)
  }

  /**
   * 整数IDから文字列IDを取得
   * @param {number} intId
   * @returns {string}
   */
  getBlockName(intId) {
    return this.idToNameMap.get(intId) || "air";
  }

  /**
   * ブロックIDからブロック定義を取得
   * @param {string} id
   * @returns {object|undefined}
   */
  get(id) {
    return this.byId.get(id);
  }

  /**
   * 全ブロック定義を取得
   * @returns {Array}
   */
  getAll() {
    return this.blocks;
  }

  /**
   * 半透明ブロックかどうか判定
   * @param {string} id
   * @returns {boolean}
   */
  isTransparent(id) {
    return this.transparentIds.has(id);
  }

  /**
   * 全テクスチャキーを取得（TextureAtlas生成用）
   * @returns {string[]}
   */
  getAllTextureKeys() {
    const keys = new Set();
    this.blocks.forEach((block) => {
      keys.add(block.iconTex);
      if (block.faces) {
        keys.add(block.faces.top);
        keys.add(block.faces.bottom);
        keys.add(block.faces.sides);
      }
    });
    return [...keys];
  }
}
