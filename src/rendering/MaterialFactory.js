import * as THREE from "three";

/**
 * ブロック別マテリアル生成 & 管理
 */
export class MaterialFactory {
  /**
   * @param {import('./TextureAtlas.js').TextureAtlas} textureAtlas
   * @param {import('../world/BlockRegistry.js').BlockRegistry} blockRegistry
   */
  constructor(textureAtlas, blockRegistry) {
    this.textureAtlas = textureAtlas;
    this.blockRegistry = blockRegistry;
    /** @type {Object<string, THREE.Material | THREE.Material[]>} */
    this.materials = {};
  }

  /**
   * 全ブロックのマテリアルを一括生成する
   */
  buildAll() {
    const blocks = this.blockRegistry.getAll();

    blocks.forEach((block) => {
      const isTrans = block.transparent;

      if (block.faces) {
        // 多面テクスチャブロック (+x, -x, +y, -y, +z, -z)
        const sides = block.faces.sides;
        const top = block.faces.top;
        const bottom = block.faces.bottom;
        this.materials[block.id] = this._makeMultiFace(
          [sides, sides, top, bottom, sides, sides],
          isTrans,
        );
      } else {
        // 単一テクスチャブロック
        const tex = this.textureAtlas.getTexture(block.iconTex);
        this.materials[block.id] = this._makeSingle(tex, isTrans);
      }
    });

    // 水は特別 (テクスチャなし、色指定)
    this.materials["water"] = new THREE.MeshLambertMaterial({
      color: 0x3388ff,
      transparent: true,
      opacity: 0.6,
    });

    // --- 【Phase 5 最適化】 チャンク描画用のアトラスマテリアル生成 ---
    const atlasTex = this.textureAtlas.getAtlasTexture();

    this.atlasOpaque = new THREE.MeshLambertMaterial({
      map: atlasTex,
      transparent: false,
      alphaTest: 0.1, // 完全な透明ピクセルを抜く
    });

    this.atlasTrans = new THREE.MeshLambertMaterial({
      map: atlasTex,
      transparent: true,
      opacity: 0.8,
      alphaTest: 0.1,
      side: THREE.DoubleSide, // 葉っぱや草などの裏面表示用
    });
  }

  /**
   * チャンク一括描画用のアトラスマテリアル配列を取得
   * @returns {THREE.Material[]} [opaque, transparent]
   */
  getAtlasMaterials() {
    return [this.atlasOpaque, this.atlasTrans];
  }

  /**
   * ブロックIDに対応するマテリアルを取得
   * @param {string} blockId
   * @returns {THREE.Material | THREE.Material[]}
   */
  get(blockId) {
    return this.materials[blockId];
  }

  // --- 内部ヘルパー ---

  _makeMultiFace(texKeys, isTrans) {
    return texKeys.map((key) => {
      const tex = this.textureAtlas.getTexture(key);
      return new THREE.MeshLambertMaterial({
        map: tex,
        transparent: isTrans,
        opacity: isTrans ? 0.8 : 1.0,
      });
    });
  }

  _makeSingle(tex, isTrans) {
    return new THREE.MeshLambertMaterial({
      map: tex,
      transparent: isTrans,
      opacity: isTrans ? 0.8 : 1.0,
      side: isTrans ? THREE.DoubleSide : THREE.FrontSide,
    });
  }
}
