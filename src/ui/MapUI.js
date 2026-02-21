import * as THREE from "three";
import { EventBus } from "../core/EventBus.js";

/**
 * 全体マップ — Canvas 2D で広範囲の俯瞰図を描画 (Mキーで開く)
 */
export class MapUI {
  /**
   * @param {import('../world/World.js').World} world
   * @param {import('../world/BlockRegistry.js').BlockRegistry} blockRegistry
   * @param {THREE.Camera} camera
   */
  constructor(world, blockRegistry, camera) {
    this.world = world;
    this.blockRegistry = blockRegistry;
    this.camera = camera;

    // マップの表示サイズ設定
    this.size = 600; // キャンバスのピクセルサイズ
    this.blockSize = 3; // 解像度と負荷のバランスを取って3に(1マス3px)
    this.range = Math.floor(this.size / this.blockSize / 2); // 中心地からの探索半径 (ブロック数)

    // Canvas要素の作成
    this.container = document.createElement("div");
    this.container.id = "map-ui";
    this.container.style.display = "none";

    this.canvas = document.createElement("canvas");
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    this.ctx = this.canvas.getContext("2d");

    const title = document.createElement("h2");
    title.innerText = "World Map";
    title.style.margin = "0 0 10px 0";
    title.style.textAlign = "center";

    this.container.appendChild(title);
    this.container.appendChild(this.canvas);
    document.body.appendChild(this.container);

    // 色マッピング（MinimapUIと同じ）
    this.colorMap = {
      grass: "#4a8505",
      dirt: "#654321",
      sand: "#eadd9e",
      stone: "#888",
      snow: "#fff",
      water: "#2266aa",
      lava: "#cc3300",
      wood: "#5c4033",
      leaves: "#228b22",
      ice: "#99ccff",
      dry_grass: "#7a7a3a",
      acacia_wood: "#6e6e6e",
      acacia_leaves: "#5d6326",
      default: "#666",
    };

    this.isRendering = false;
  }

  /**
   * マップ全体の描画 (非同期で行分割描画しフリーズを防ぐ)
   */
  render() {
    if (this.isRendering) return;
    this.isRendering = true;

    const px = Math.floor(this.camera.position.x);
    const pz = Math.floor(this.camera.position.z);

    // 背景クリア
    this.ctx.fillStyle = "#1a1a2e";
    this.ctx.fillRect(0, 0, this.size, this.size);

    let dz = -this.range;

    const renderRow = () => {
      // マップが閉じられた場合は描画を中断
      if (this.container.style.display === "none") {
        this.isRendering = false;
        return;
      }

      // 1フレームあたり10行を描画 (バランス調整)
      const rowsPerFrame = 10;
      for (let i = 0; i < rowsPerFrame; i++) {
        if (dz > this.range) {
          this._drawPlayerIcon();
          this.isRendering = false;
          return;
        }

        const wz = pz + dz;
        const sy = (dz + this.range) * this.blockSize;

        for (let dx = -this.range; dx <= this.range; dx++) {
          const wx = px + dx;
          const sx = (dx + this.range) * this.blockSize;

          // 地表ブロック探索 (高い位置から順に)
          let color = null;
          for (let y = 60; y >= -10; y -= 1) {
            // getBlockTypeAt を使うことで水等の半透明ブロックも検出、途中で即 break 可能に
            const type = this.world.getBlockTypeAt(wx, y, wz);
            if (type && type !== "air") {
              color = this.colorMap[type] || this.colorMap.default;
              // 高さによる明暗調整（陰影）
              const brightness = Math.min(1.2, 0.4 + (y + 10) / 40);
              color = this._adjustBrightness(color, brightness);
              break;
            }
          }

          if (color) {
            this.ctx.fillStyle = color;
            this.ctx.fillRect(sx, sy, this.blockSize, this.blockSize);
          }
        }
        dz++;
      }

      // 次のループをスケジュール
      requestAnimationFrame(renderRow);
    };

    // 描画開始
    renderRow();
  }

  _drawPlayerIcon() {
    const center = this.range * this.blockSize;
    this.ctx.fillStyle = "#ff4444";
    this.ctx.beginPath();
    this.ctx.arc(center, center, 4, 0, Math.PI * 2);
    this.ctx.fill();

    // プレイヤーの向いている方向を描画
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    this.ctx.strokeStyle = "#ffffff";
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(center, center);
    this.ctx.lineTo(center + dir.x * 12, center + dir.z * 12);
    this.ctx.stroke();
  }

  _adjustBrightness(hex, factor) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const clamp = (v) => Math.min(255, Math.max(0, Math.round(v * factor)));
    return `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`;
  }
}
