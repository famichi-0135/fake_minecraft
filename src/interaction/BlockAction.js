import * as THREE from "three";
import { EventBus } from "../core/EventBus.js";
import { DROP_CONVERSION } from "../core/Constants.js";

/**
 * ブロック破壊・設置ロジック
 */
export class BlockAction {
  /**
   * @param {import('../world/World.js').World} world
   * @param {import('./Raycaster.js').BlockRaycaster} raycaster
   * @param {import('./DropItem.js').DropItemManager} dropItemManager
   * @param {import('../player/Physics.js').Physics} physics
   * @param {THREE.Camera} camera
   */
  constructor(world, raycaster, dropItemManager, physics, camera) {
    this.world = world;
    this.raycaster = raycaster;
    this.dropItemManager = dropItemManager;
    this.physics = physics;
    this.camera = camera;

    // 入力イベント購読
    EventBus.on("input:attack", () => this.destroyBlock());
    EventBus.on("input:use", () => this.placeBlock());
  }

  /**
   * ブロック破壊
   */
  destroyBlock() {
    const intersect = this.raycaster.getLookingAtBlock();
    if (!intersect) return;

    // Raycaster経由での破壊インターフェース (BufferGeometry対応)
    const result = this.world.destroyBlock(intersect);
    if (!result) return;

    // 石 → 丸石 などの変換
    const dropType = DROP_CONVERSION[result.type] || result.type;
    this.dropItemManager.spawn(
      result.pos.x,
      result.pos.y,
      result.pos.z,
      dropType,
    );

    EventBus.emit("block:destroyed", { pos: result.pos, type: result.type });
    EventBus.emit("world:save");
  }

  /** 設置不可アイテム (食べ物・ツール・素材) */
  static NON_PLACEABLE = new Set([
    "apple",
    "bread",
    "raw_meat",
    "cooked_meat",
    "stick",
    "iron_ingot",
    "gold_ingot",
    "diamond",
    "charcoal",
    "wooden_pickaxe",
    "stone_pickaxe",
    "iron_pickaxe",
    "diamond_pickaxe",
    "wooden_sword",
    "stone_sword",
    "wooden_shovel",
  ]);

  /**
   * ブロック設置
   */
  placeBlock() {
    const intersect = this.raycaster.getLookingAtBlock();
    if (!intersect) return;

    // 選択中のブロック取得をイベントで問い合わせ
    let blockToPlace = null;
    let hasItem = false;

    // 同期的にhotbar/inventoryから取得
    EventBus.emit("hotbar:query-selected", {
      callback: (type, count) => {
        blockToPlace = type;
        hasItem = count > 0;
      },
    });

    if (!blockToPlace || !hasItem) return;
    // 設置不可アイテムはスキップ
    if (BlockAction.NON_PLACEABLE.has(blockToPlace)) return;

    // 設置位置計算: intersect.object.position (元ボクセルの中心) + intersect.face.normal
    const voxelPos = intersect.object.position
      .clone()
      .add(intersect.face.normal);
    voxelPos.x = Math.floor(voxelPos.x + 0.5);
    voxelPos.y = Math.floor(voxelPos.y + 0.5);
    voxelPos.z = Math.floor(voxelPos.z + 0.5);

    // プレイヤー重複チェック
    const p = this.camera.position;
    if (
      this.physics.isOverlappingPlayer(
        voxelPos.x,
        voxelPos.y,
        voxelPos.z,
        p.x,
        p.y,
        p.z,
      )
    ) {
      return;
    }

    this.world.placeBlock(voxelPos, blockToPlace);
    EventBus.emit("block:placed", { pos: voxelPos, type: blockToPlace });
    EventBus.emit("world:save");
  }
}
