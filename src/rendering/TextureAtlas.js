import * as THREE from "three";

/**
 * プロシージャルテクスチャ生成 & キャッシュ管理
 * Canvas 16×16 で各ブロックテクスチャを動的に生成する
 */
export class TextureAtlas {
  constructor() {
    // 巨大なアトラス用Canvas (512x512 = 32x32タイル = 1024種のテクスチャまで対応可)
    this.atlasSize = 512;
    this.tileSize = 16;
    this.tileCountX = this.atlasSize / this.tileSize;

    this.canvas = document.createElement("canvas");
    this.canvas.width = this.atlasSize;
    this.canvas.height = this.atlasSize;
    this.ctx = this.canvas.getContext("2d");

    // 全体を管理するただ一つの中央テクスチャ
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;

    /** @type {Map<string, {u: number, v: number, size: number}>} UVマッピング */
    this.uvOffsets = new Map();

    /** @type {Map<string, THREE.CanvasTexture>} 従来の個別テクスチャキャッシュ */
    this.textures = new Map();

    /** @type {Map<string, string>} アイコン Data-URL キャッシュ (UI用別キャンバス) */
    this.icons = new Map();

    this.currentIndex = 0;
  }

  /**
   * Worker で計算するための UVマップデータをJSON形式で取得
   */
  getUVMap() {
    return Object.fromEntries(this.uvOffsets);
  }
  generateAll(keys) {
    // 追加の面テクスチャキー
    const extraKeys = [
      "bookshelf_top",
      "grass_top",
      "wood_top",
      "acacia_top",
      "furnace_top",
      "chest_top",
    ];
    const allKeys = [...new Set([...keys, ...extraKeys])];
    allKeys.forEach((key) => this.generate(key));
  }

  /**
   * 単一テクスチャをアトラス上に生成してキャッシュする
   * @param {string} type - テクスチャキー
   * @returns {void}
   */
  generate(type) {
    if (this.uvOffsets.has(type)) return;

    // 現在の追加先タイル位置
    const i = this.currentIndex++;
    const tx = (i % this.tileCountX) * this.tileSize;
    const ty = Math.floor(i / this.tileCountX) * this.tileSize;

    // 描画用のテンポラリキャンバス
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = this.tileSize;
    tempCanvas.height = this.tileSize;
    const tempCtx = tempCanvas.getContext("2d");

    // プロシージャル描画 (16x16)
    this._drawTexture(tempCtx, type);

    // アトラスに焼き付ける
    this.ctx.drawImage(tempCanvas, tx, ty);

    // Three.js の UV座標空間 (左下(0,0) -> 右上(1,1)) に合わせる
    const u = tx / this.atlasSize;
    const v = 1.0 - (ty + this.tileSize) / this.atlasSize;
    const uvSize = this.tileSize / this.atlasSize;

    this.uvOffsets.set(type, { u, v, size: uvSize });

    // UIアイコン用 キャッシュ
    if (type !== "bookshelf_top") {
      this.icons.set(type, tempCanvas.toDataURL());
    }

    // 従来の個別CanvasTextureとしてもキャッシュ (ドロップアイテムやUI用)
    const texture = new THREE.CanvasTexture(tempCanvas);
    texture.name = type;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    this.textures.set(type, texture);

    // テクスチャ更新フラグ
    this.texture.needsUpdate = true;
  }

  /**
   * アイコン Data-URL を取得
   * @param {string} key
   * @returns {string}
   */
  getIcon(key) {
    return this.icons.get(key) || "";
  }

  /**
   * 個別テクスチャを取得
   * @param {string} key
   * @returns {THREE.CanvasTexture}
   */
  getTexture(key) {
    return this.textures.get(key);
  }

  /**
   * アトラス全体を１枚のテクスチャとして取得
   * @returns {THREE.CanvasTexture}
   */
  getAtlasTexture() {
    return this.texture;
  }

  // --- 内部: テクスチャ描画 ---

  _fillNoise(ctx, cBase, c1, c2, prob) {
    ctx.fillStyle = cBase;
    ctx.fillRect(0, 0, 16, 16);
    for (let i = 0; i < 256; i++) {
      if (Math.random() < prob) {
        ctx.fillStyle = Math.random() > 0.5 ? c1 : c2;
        ctx.fillRect(i % 16, Math.floor(i / 16), 1, 1);
      }
    }
  }

  _drawOre(ctx, baseCol, spotCol) {
    this._fillNoise(ctx, baseCol, "#888888", "#666666", 0.6);
    ctx.fillStyle = spotCol;
    for (let i = 0; i < 15; i++) {
      ctx.fillRect(
        Math.floor(Math.random() * 14) + 1,
        Math.floor(Math.random() * 14) + 1,
        2,
        2,
      );
    }
  }

  _drawTexture(ctx, type) {
    const fn = this._fillNoise.bind(this, ctx);

    switch (type) {
      case "grass_top":
        fn("#4a8505", "#559c06", "#3c6e04", 0.5);
        break;
      case "dirt":
        fn("#654321", "#704b25", "#57391b", 0.5);
        break;
      case "sand":
        fn("#eadd9e", "#f5deb3", "#d2b48c", 0.4);
        break;
      case "stone":
        fn("#777777", "#888888", "#666666", 0.6);
        break;
      case "cobblestone":
        fn("#666666", "#555555", "#777777", 0.7);
        ctx.fillStyle = "#444";
        ctx.fillRect(0, 0, 16, 1);
        ctx.fillRect(0, 8, 16, 1);
        ctx.fillRect(8, 0, 1, 8);
        ctx.fillRect(4, 8, 1, 8);
        break;
      case "coal_ore":
        this._drawOre(ctx, "#777777", "#222222");
        break;
      case "iron_ore":
        this._drawOre(ctx, "#777777", "#d8af93");
        break;
      case "gold_ore":
        this._drawOre(ctx, "#777777", "#fcee4b");
        break;
      case "diamond_ore":
        this._drawOre(ctx, "#777777", "#5decf2");
        break;
      case "dry_grass":
        fn("#7a7a3a", "#8a8a4a", "#6a6a2a", 0.5);
        break;
      case "leaves":
        fn("#228b22", "#006400", "#32cd32", 0.6);
        ctx.globalCompositeOperation = "destination-out";
        for (let i = 0; i < 30; i++)
          ctx.fillRect(Math.random() * 16, Math.random() * 16, 1, 1);
        ctx.globalCompositeOperation = "source-over";
        break;
      case "acacia_leaves":
        fn("#5d6326", "#6d7336", "#4d5316", 0.6);
        ctx.globalCompositeOperation = "destination-out";
        for (let i = 0; i < 40; i++)
          ctx.fillRect(Math.random() * 16, Math.random() * 16, 1, 1);
        ctx.globalCompositeOperation = "source-over";
        break;
      case "wood_side":
        ctx.fillStyle = "#5c4033";
        ctx.fillRect(0, 0, 16, 16);
        ctx.fillStyle = "#3e2723";
        for (let i = 0; i < 16; i += 2) ctx.fillRect(i, 0, 1, 16);
        break;
      case "wood_top":
        ctx.fillStyle = "#8b5a2b";
        ctx.fillRect(0, 0, 16, 16);
        ctx.fillStyle = "#a0522d";
        ctx.beginPath();
        ctx.arc(8, 8, 6, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case "acacia_side":
        ctx.fillStyle = "#6e6e6e";
        ctx.fillRect(0, 0, 16, 16);
        ctx.fillStyle = "#555555";
        for (let i = 0; i < 16; i += 2) ctx.fillRect(i, 0, 1, 16);
        break;
      case "acacia_top":
        ctx.fillStyle = "#b55e28";
        ctx.fillRect(0, 0, 16, 16);
        ctx.fillStyle = "#8a4012";
        ctx.beginPath();
        ctx.arc(8, 8, 5, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case "planks":
      case "bookshelf_top":
        ctx.fillStyle = "#c08a4f";
        ctx.fillRect(0, 0, 16, 16);
        ctx.fillStyle = "#a1723f";
        for (let i = 3; i < 16; i += 4) ctx.fillRect(i, 0, 1, 16);
        for (let i = 0; i < 20; i++)
          ctx.fillRect(Math.random() * 16, Math.random() * 16, 2, 1);
        break;
      case "grass_side":
        fn("#654321", "#704b25", "#57391b", 0.5);
        ctx.fillStyle = "#4a8505";
        ctx.fillRect(0, 0, 16, 5);
        for (let i = 0; i < 16; i++) {
          if (Math.random() > 0.3)
            ctx.fillRect(i, 5, 1, Math.floor(Math.random() * 3));
        }
        break;
      case "glass":
        ctx.fillStyle = "#bce6eb";
        ctx.fillRect(0, 0, 16, 16);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(1, 1, 14, 1);
        ctx.fillRect(1, 1, 1, 14);
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = "#fff";
        ctx.fillRect(3, 3, 4, 14);
        ctx.globalAlpha = 1.0;
        break;
      case "brick":
        ctx.fillStyle = "#9e4b3e";
        ctx.fillRect(0, 0, 16, 16);
        ctx.fillStyle = "#ccc";
        for (let y = 3; y < 16; y += 4) ctx.fillRect(0, y, 16, 1);
        for (let y = 0; y < 16; y += 8) {
          ctx.fillRect(7, y, 1, 4);
          ctx.fillRect(3, y + 4, 1, 4);
          ctx.fillRect(11, y + 4, 1, 4);
        }
        break;
      case "bookshelf_side": {
        ctx.fillStyle = "#c08a4f";
        ctx.fillRect(0, 0, 16, 16);
        ctx.fillStyle = "#442";
        ctx.fillRect(1, 2, 14, 5);
        ctx.fillRect(1, 9, 14, 5);
        const cols = ["#d32f2f", "#388e3c", "#1976d2", "#fbc02d", "#8e24aa"];
        for (const y of [2, 9]) {
          let x = 1;
          while (x < 15) {
            let w = Math.floor(Math.random() * 2) + 2;
            if (x + w > 15) w = 15 - x;
            ctx.fillStyle = cols[Math.floor(Math.random() * cols.length)];
            ctx.fillRect(x, y, w - 0.5, 5);
            x += w;
          }
        }
        break;
      }
      case "obsidian":
        fn("#1a0f2e", "#2a1f3e", "#0a001e", 0.8);
        break;
      case "snow":
        fn("#ffffff", "#f0f0f0", "#e0e0e0", 0.3);
        break;
      case "ice":
        ctx.fillStyle = "#99ccff";
        ctx.fillRect(0, 0, 16, 16);
        ctx.fillStyle = "#bbddff";
        ctx.fillRect(0, 0, 16, 2);
        ctx.fillRect(0, 0, 2, 16);
        break;
      case "water":
        ctx.fillStyle = "#2266aa";
        ctx.fillRect(0, 0, 16, 16);
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = "#44aaff";
        for (let i = 0; i < 40; i++) {
          ctx.fillRect(Math.random() * 16, Math.random() * 16, 2, 1);
        }
        ctx.globalAlpha = 1.0;
        break;
      case "lava":
        ctx.fillStyle = "#cc3300";
        ctx.fillRect(0, 0, 16, 16);
        ctx.fillStyle = "#ff6600";
        for (let i = 0; i < 60; i++) {
          ctx.fillRect(Math.random() * 16, Math.random() * 16, 2, 2);
        }
        ctx.fillStyle = "#ffcc00";
        for (let i = 0; i < 20; i++) {
          ctx.fillRect(Math.random() * 14 + 1, Math.random() * 14 + 1, 1, 1);
        }
        break;
      // --- 新ブロック・アイテム ---
      case "torch":
        ctx.fillStyle = "#2a2a2a";
        ctx.fillRect(0, 0, 16, 16);
        ctx.clearRect(0, 0, 16, 16);
        ctx.fillStyle = "#8b6914";
        ctx.fillRect(7, 4, 2, 12);
        ctx.fillStyle = "#ff9900";
        ctx.fillRect(6, 2, 4, 4);
        ctx.fillStyle = "#ffcc00";
        ctx.fillRect(7, 1, 2, 3);
        break;
      case "furnace":
        fn("#555", "#666", "#444", 0.6);
        ctx.fillStyle = "#222";
        ctx.fillRect(4, 6, 8, 8);
        ctx.fillStyle = "#ff6600";
        ctx.fillRect(5, 8, 6, 5);
        break;
      case "furnace_top":
        fn("#555", "#666", "#444", 0.6);
        ctx.fillStyle = "#333";
        ctx.fillRect(4, 4, 8, 8);
        break;
      case "chest":
        ctx.fillStyle = "#8b5a2b";
        ctx.fillRect(0, 0, 16, 16);
        ctx.fillStyle = "#6b3a1b";
        ctx.fillRect(0, 7, 16, 2);
        ctx.fillStyle = "#daa520";
        ctx.fillRect(6, 6, 4, 4);
        break;
      case "chest_top":
        ctx.fillStyle = "#8b5a2b";
        ctx.fillRect(0, 0, 16, 16);
        ctx.fillStyle = "#6b3a1b";
        ctx.fillRect(2, 2, 12, 12);
        break;
      case "ladder":
        ctx.clearRect(0, 0, 16, 16);
        ctx.fillStyle = "#8b6914";
        ctx.fillRect(2, 0, 2, 16);
        ctx.fillRect(12, 0, 2, 16);
        for (let y = 2; y < 16; y += 4) ctx.fillRect(2, y, 12, 2);
        break;
      case "stick":
        ctx.clearRect(0, 0, 16, 16);
        ctx.fillStyle = "#8b6914";
        ctx.fillRect(7, 2, 2, 12);
        break;
      case "iron_ingot":
        ctx.fillStyle = "#ccc";
        ctx.fillRect(0, 0, 16, 16);
        ctx.clearRect(0, 0, 16, 16);
        ctx.fillStyle = "#d8d8d8";
        ctx.fillRect(3, 5, 10, 6);
        ctx.fillStyle = "#bbb";
        ctx.fillRect(4, 6, 8, 4);
        break;
      case "gold_ingot":
        ctx.clearRect(0, 0, 16, 16);
        ctx.fillStyle = "#ffd700";
        ctx.fillRect(3, 5, 10, 6);
        ctx.fillStyle = "#daa520";
        ctx.fillRect(4, 6, 8, 4);
        break;
      case "diamond":
        ctx.clearRect(0, 0, 16, 16);
        ctx.fillStyle = "#5decf2";
        ctx.fillRect(5, 3, 6, 10);
        ctx.fillStyle = "#4bc8d4";
        ctx.fillRect(4, 5, 8, 6);
        ctx.fillStyle = "#aaf5ff";
        ctx.fillRect(6, 5, 2, 2);
        break;
      case "charcoal":
        ctx.clearRect(0, 0, 16, 16);
        ctx.fillStyle = "#333";
        ctx.fillRect(4, 4, 8, 8);
        ctx.fillStyle = "#555";
        ctx.fillRect(5, 5, 3, 3);
        break;
      case "flower_red":
        ctx.clearRect(0, 0, 16, 16);
        ctx.fillStyle = "#228b22";
        ctx.fillRect(7, 8, 2, 6);
        ctx.fillStyle = "#ff2222";
        ctx.fillRect(5, 4, 6, 5);
        ctx.fillStyle = "#ff6666";
        ctx.fillRect(6, 3, 4, 2);
        break;
      case "flower_yellow":
        ctx.clearRect(0, 0, 16, 16);
        ctx.fillStyle = "#228b22";
        ctx.fillRect(7, 8, 2, 6);
        ctx.fillStyle = "#ffdd00";
        ctx.fillRect(5, 4, 6, 5);
        ctx.fillStyle = "#ffee66";
        ctx.fillRect(6, 3, 4, 2);
        break;
      case "tall_grass":
        ctx.clearRect(0, 0, 16, 16);
        ctx.fillStyle = "#3a7a0a";
        for (let i = 0; i < 8; i++) {
          const gx = 2 + Math.floor(Math.random() * 12);
          ctx.fillRect(
            gx,
            4 + Math.floor(Math.random() * 4),
            1,
            6 + Math.floor(Math.random() * 6),
          );
        }
        break;
      case "apple":
        ctx.clearRect(0, 0, 16, 16);
        ctx.fillStyle = "#cc2222";
        ctx.fillRect(5, 5, 6, 7);
        ctx.fillStyle = "#228b22";
        ctx.fillRect(7, 3, 2, 3);
        break;
      case "bread":
        ctx.clearRect(0, 0, 16, 16);
        ctx.fillStyle = "#d4a340";
        ctx.fillRect(3, 7, 10, 5);
        ctx.fillStyle = "#c08a30";
        ctx.fillRect(4, 6, 8, 2);
        break;
      case "raw_meat":
        ctx.clearRect(0, 0, 16, 16);
        ctx.fillStyle = "#cc5555";
        ctx.fillRect(3, 5, 10, 7);
        ctx.fillStyle = "#ffcccc";
        ctx.fillRect(5, 6, 3, 4);
        break;
      case "cooked_meat":
        ctx.clearRect(0, 0, 16, 16);
        ctx.fillStyle = "#8b4513";
        ctx.fillRect(3, 5, 10, 7);
        ctx.fillStyle = "#a0522d";
        ctx.fillRect(5, 6, 3, 4);
        break;
      case "wooden_pickaxe":
      case "stone_pickaxe":
      case "iron_pickaxe":
      case "diamond_pickaxe": {
        ctx.clearRect(0, 0, 16, 16);
        const headColors = {
          wooden_pickaxe: "#8b6914",
          stone_pickaxe: "#888",
          iron_pickaxe: "#ccc",
          diamond_pickaxe: "#5decf2",
        };
        ctx.fillStyle = "#8b6914";
        ctx.fillRect(7, 6, 2, 10);
        ctx.fillStyle = headColors[type];
        ctx.fillRect(3, 2, 10, 4);
        break;
      }
      case "wooden_sword":
      case "stone_sword": {
        ctx.clearRect(0, 0, 16, 16);
        const sColors = { wooden_sword: "#8b6914", stone_sword: "#888" };
        ctx.fillStyle = "#8b6914";
        ctx.fillRect(7, 10, 2, 6);
        ctx.fillStyle = "#daa520";
        ctx.fillRect(5, 9, 6, 2);
        ctx.fillStyle = sColors[type];
        ctx.fillRect(7, 1, 2, 9);
        break;
      }
      case "wooden_shovel":
        ctx.clearRect(0, 0, 16, 16);
        ctx.fillStyle = "#8b6914";
        ctx.fillRect(7, 6, 2, 10);
        ctx.fillStyle = "#8b6914";
        ctx.fillRect(5, 2, 6, 5);
        break;
      default:
        ctx.fillStyle = "#ff00ff";
        ctx.fillRect(0, 0, 16, 16);
        break;
    }
  }
}
