/**
 * ミニマップ — Canvas 2D で俯瞰図を描画
 */
export class MinimapUI {
  /**
   * @param {import('../world/World.js').World} world
   * @param {import('../world/BlockRegistry.js').BlockRegistry} blockRegistry
   */
  constructor(world, blockRegistry) {
    this.world = world;
    this.blockRegistry = blockRegistry;
    this.size = 120;
    this.blockSize = 2;
    this.range = Math.floor(this.size / this.blockSize / 2);

    // Canvas作成
    this.canvas = document.createElement("canvas");
    this.canvas.id = "minimap";
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    this.ctx = this.canvas.getContext("2d");
    document.body.appendChild(this.canvas);

    // 色マッピング
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

    // 分散更新用のステート
    this.currentRow = -this.range;
    this.updateRadius = this.range;
  }

  /**
   * 毎フレーム数行ずつ更新する (スパイク防止)
   * @param {THREE.Vector3} playerPos
   */
  update(playerPos) {
    const px = Math.floor(playerPos.x);
    const pz = Math.floor(playerPos.z);

    // 毎フレーム 6 行だけ更新して負荷分散 (約10フレームで一周)
    const ROWS_PER_FRAME = 6;

    for (let i = 0; i < ROWS_PER_FRAME; i++) {
      const dz = this.currentRow;
      const wz = pz + dz;

      // 1行分クリア (黒に近い色で塗りつぶす)
      const sy = (dz + this.range) * this.blockSize;
      // プレイヤー周辺だけ少し明るくするなど工夫も可能だが、今回は一律の背景色でクリア
      this.ctx.fillStyle = "#1a1a2e";
      this.ctx.fillRect(0, sy, this.size, this.blockSize);

      for (let dx = -this.range; dx <= this.range; dx++) {
        const wx = px + dx;

        // 地表ブロック取得 (上から探索)
        let color = null;
        for (let y = 30; y >= -10; y--) {
          const type = this.world.getSolidBlockType(wx, y, wz);
          if (type) {
            color = this.colorMap[type] || this.colorMap.default;
            // 高さに応じて明暗
            const brightness = Math.min(1.2, 0.6 + y / 30);
            color = this._adjustBrightness(color, brightness);
            break;
          }
        }

        if (color) {
          const sx = (dx + this.range) * this.blockSize;
          this.ctx.fillStyle = color;
          this.ctx.fillRect(sx, sy, this.blockSize, this.blockSize);
        }
      }

      // 次の行へ
      this.currentRow++;
      if (this.currentRow > this.range) {
        this.currentRow = -this.range;
      }
    }

    // プレイヤー位置 (中心) は常に上書き描画
    const center = this.range * this.blockSize;
    this.ctx.fillStyle = "#ff4444";
    this.ctx.fillRect(center - 1, center - 1, 3, 3);
  }

  _adjustBrightness(hex, factor) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const clamp = (v) => Math.min(255, Math.max(0, Math.round(v * factor)));
    return `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`;
  }
}
