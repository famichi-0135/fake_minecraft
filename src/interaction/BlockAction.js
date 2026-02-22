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
   * @param {import('../entity/EntityManager.js').EntityManager} entityManager
   */
  constructor(
    world,
    raycaster,
    dropItemManager,
    physics,
    camera,
    entityManager,
  ) {
    this.world = world;
    this.raycaster = raycaster;
    this.dropItemManager = dropItemManager;
    this.physics = physics;
    this.camera = camera;
    this.entityManager = entityManager;

    // 採掘プログレス管理
    this.miningProgress = 0;
    this.lastMiningPos = null;

    // 採掘アニメーション用メッシュ（ブロックより少しだけ大きくして重ねる）
    const geo = new THREE.BoxGeometry(1.01, 1.01, 1.01);
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      depthTest: true,
      depthWrite: false, // 本来のブロック描画と干渉させない
      alphaTest: 0.1,
      opacity: 0.8,
    });
    this.destroyMesh = new THREE.Mesh(geo, mat);
    this.destroyMesh.visible = false;
    this.world.scene.add(this.destroyMesh);

    // 入力イベント購読
    EventBus.on("input:attack", () => this.destroyBlock());
    EventBus.on("input:use", () => this.placeBlock());
    EventBus.on("input:attack-stop", () => this.stopDestroyBlock());
  }

  /**
   * 破壊（長押し）をやめた時のリセット処理
   */
  stopDestroyBlock() {
    this.miningProgress = 0;
    this.lastMiningPos = null;
    if (this.destroyMesh) this.destroyMesh.visible = false;
  }

  /**
   * ブロック破壊またはモブ攻撃（長押しによる進行度管理版）
   */
  destroyBlock() {
    // ------------------------------------
    // 1. エンティティ（モブ）への攻撃判定
    // ------------------------------------
    if (this.entityManager) {
      const meshes = [];
      const meshToEntity = new Map();
      for (const entity of this.entityManager.entities) {
        if (entity.mesh) {
          meshes.push(entity.mesh);
          meshToEntity.set(entity.mesh, entity);
        }
      }

      // レイの設定（視線中央）
      this.raycaster.raycaster.setFromCamera(
        new THREE.Vector2(0, 0),
        this.camera,
      );
      const intersects = this.raycaster.raycaster.intersectObjects(
        meshes,
        true,
      );

      if (intersects.length > 0 && intersects[0].distance < 4.5) {
        // REACH_DISTANCE(5.0)より少し短め
        let hitMesh = intersects[0].object;
        while (hitMesh && !meshToEntity.has(hitMesh) && hitMesh.parent) {
          hitMesh = hitMesh.parent;
          if (meshToEntity.has(hitMesh)) break;
        }

        const entity = meshToEntity.get(hitMesh);
        if (entity) {
          // ダメージ計算
          let damage = 1; // 素手ダメージ
          let selectedItem = null;
          EventBus.emit("hotbar:query-selected", {
            callback: (type) => {
              selectedItem = type;
            },
          });

          if (selectedItem) {
            const itemDef = this.world.blockRegistry.get(selectedItem);
            if (itemDef && itemDef.damage) {
              damage = itemDef.damage;
            }
          }

          entity.takeDamage(damage, { position: this.camera.position });

          this.stopDestroyBlock();
          return; // モブを叩いた場合はブロック破壊は行わない
        }
      }
    }

    // ------------------------------------
    // 2. ブロックへの破壊判定
    // ------------------------------------
    const intersect = this.raycaster.getLookingAtBlock();
    if (!intersect) {
      this.stopDestroyBlock();
      return;
    }

    const blockPos = intersect.voxelData;
    const posHash = `${blockPos.x},${blockPos.y},${blockPos.z}`;
    if (this.lastMiningPos !== posHash) {
      this.miningProgress = 0;
      this.lastMiningPos = posHash;
      if (this.destroyMesh) this.destroyMesh.visible = false;
    }

    // ブロック属性を取得
    const blockType = this.world.getBlockTypeAt(
      blockPos.x,
      blockPos.y,
      blockPos.z,
    );
    if (!blockType) return;
    const blockDef = this.world.blockRegistry.get(blockType);
    if (!blockDef) return;

    // 手持ちのツールを取得
    let selectedItem = null;
    EventBus.emit("hotbar:query-selected", {
      callback: (type) => {
        selectedItem = type;
      },
    });

    let toolSpeed = 1;
    let toolType = null;
    let toolLevel = 0;

    if (selectedItem) {
      const itemDef = this.world.blockRegistry.get(selectedItem);
      if (itemDef && itemDef.toolType) {
        toolSpeed = itemDef.miningSpeed || 1;
        toolType = itemDef.toolType;
        toolLevel = itemDef.toolLevel || 0;
      }
    }

    // 採掘の成否判定（適正ツールのレベルを満たしているか）
    let canBreak = true;
    let effectiveSpeed = toolSpeed;

    if (blockDef.requiredTool) {
      if (
        toolType !== blockDef.requiredTool ||
        toolLevel < blockDef.requiredToolLevel
      ) {
        canBreak = false; // アイテムはドロップしない
        effectiveSpeed = 1; // 掘る速度ペナルティ
      }
    }

    const hardness = blockDef.hardness !== undefined ? blockDef.hardness : 1.0;

    // ACTION_INTERVAL (0.2秒) ごとに削る
    if (hardness <= 0) {
      this.miningProgress = 9999;
    } else {
      this.miningProgress += (0.2 * effectiveSpeed) / hardness;
    }

    // 破壊エフェクト（ひび割れメッシュ）の更新
    if (this.miningProgress > 0 && this.miningProgress < 1.0) {
      this.destroyMesh.position.set(blockPos.x, blockPos.y, blockPos.z);
      this.destroyMesh.visible = true;
      // 0.0〜1.0 の進行度を 0〜9 のステージにマッピング
      const stage = Math.floor(Math.min(0.99, this.miningProgress) * 10);
      this.destroyMesh.material.map =
        this.world.textureAtlas.getDestroyTexture(stage);
      this.destroyMesh.material.needsUpdate = true;
    }

    // 破壊完了
    if (this.miningProgress >= 1.0) {
      this.stopDestroyBlock();

      const result = this.world.destroyBlock(intersect);
      if (!result) return;

      // 破壊エフェクト・音など
      EventBus.emit("block:destroyed", {
        pos: result.pos,
        type: result.type,
      });
      EventBus.emit("world:save");

      // 条件を満たしていればドロップ生成
      if (canBreak) {
        const dropType = DROP_CONVERSION[result.type] || result.type;
        this.dropItemManager.spawn(
          result.pos.x,
          result.pos.y,
          result.pos.z,
          dropType,
        );
      }
    }
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
