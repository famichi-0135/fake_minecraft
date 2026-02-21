// --- スタイル ---
import "../styles/main.css";
import "../styles/hud.css";
import "../styles/inventory.css";
import "../styles/pause.css";
import "../styles/survival.css";

import { CHUNK_SIZE } from "./core/Constants.js";

// --- Core ---
import { Engine } from "./core/Engine.js";
import { EventBus } from "./core/EventBus.js";

// --- Rendering ---
import { TextureAtlas } from "./rendering/TextureAtlas.js";
import { MaterialFactory } from "./rendering/MaterialFactory.js";
import { ParticleSystem } from "./rendering/ParticleSystem.js";

// --- World ---
import { BlockRegistry } from "./world/BlockRegistry.js";
import { World } from "./world/World.js";
import { DayNightCycle } from "./world/DayNightCycle.js";

// --- Player ---
import { InputManager } from "./player/InputManager.js";
import { Physics } from "./player/Physics.js";
import { PlayerController } from "./player/PlayerController.js";
import { Health } from "./player/Health.js";
import { Hunger } from "./player/Hunger.js";

// --- Interaction ---
import { BlockRaycaster } from "./interaction/Raycaster.js";
import { DropItemManager } from "./interaction/DropItem.js";
import { BlockAction } from "./interaction/BlockAction.js";

// --- Inventory ---
import { Inventory } from "./inventory/Inventory.js";
import { Hotbar } from "./inventory/Hotbar.js";
import { CraftingSystem } from "./inventory/CraftingSystem.js";
import { ToolSystem } from "./inventory/ToolSystem.js";
import { Furnace } from "./inventory/Furnace.js";

// --- UI ---
import { PauseScreen } from "./ui/PauseScreen.js";
import { HotbarUI } from "./ui/HotbarUI.js";
import { InventoryUI } from "./ui/InventoryUI.js";
import { CraftingUI } from "./ui/CraftingUI.js";
import { UIManager } from "./ui/UIManager.js";
import { HealthBarUI } from "./ui/HealthBarUI.js";
import { HungerBarUI } from "./ui/HungerBarUI.js";
import { TimeBarUI } from "./ui/TimeBarUI.js";
import { MinimapUI } from "./ui/MinimapUI.js";

// --- Storage ---
import { SaveManager } from "./storage/SaveManager.js";

// --- Audio ---
import { SoundManager } from "./audio/SoundManager.js";

// ===== ブートストラップ =====
function boot() {
  const canvas = document.getElementById("game-canvas");

  // 1. エンジン初期化
  const engine = new Engine(canvas);
  const scene = engine.getScene();
  const camera = engine.getCamera();

  // 2. テクスチャ & マテリアル
  const blockRegistry = new BlockRegistry();
  const textureAtlas = new TextureAtlas();
  textureAtlas.generateAll(blockRegistry.getAllTextureKeys());
  const materialFactory = new MaterialFactory(textureAtlas, blockRegistry);
  materialFactory.buildAll();

  // 3. セーブデータ復元
  const saveManager = new SaveManager();
  const savedData = saveManager.load();
  const modifiedBlocks = savedData?.blocks || {};

  // 4. インベントリ & ホットバー & ツール & 精錬
  const inventory = new Inventory();
  const hotbar = new Hotbar(inventory);
  const toolSystem = new ToolSystem(inventory);
  const furnace = new Furnace(inventory);
  if (savedData?.inventory) inventory.loadFrom(savedData.inventory);
  if (savedData?.hotbar) hotbar.loadFrom(savedData.hotbar);

  // アイテム回収イベント
  EventBus.on("item:picked", ({ type, count }) => {
    inventory.add(type, count);
    EventBus.emit("world:save");
  });
  // ブロック設置時にインベントリから消費
  EventBus.on("block:placed", ({ type }) => {
    inventory.consume(type, 1);
    EventBus.emit("world:save");
  });

  // 食べ物データ
  const foodMap = {
    apple: 4,
    bread: 8,
    raw_meat: 3,
    cooked_meat: 8,
  };
  // 右クリックで食べ物を消費 (ブロック設置より先に判定)
  EventBus.on("input:use", () => {
    const selected = hotbar.getSelectedType();
    if (selected && foodMap[selected]) {
      const count = inventory.getCount(selected);
      if (count > 0 && hunger.current < hunger.max) {
        inventory.consume(selected, 1);
        hunger.feed(foodMap[selected]);
        EventBus.emit("world:save");
      }
    }
  });

  // 5. ワールド
  const world = new World(
    scene,
    materialFactory,
    textureAtlas,
    blockRegistry,
    modifiedBlocks,
  );

  // 6. サバイバルシステム
  const health = new Health(20);
  const hunger = new Hunger(health, 20);

  // リスポーン処理
  EventBus.on("player:respawn", () => {
    camera.position.set(8, 60, 8);
    hunger.reset();
  });

  // 7. プレイヤー
  const inputManager = new InputManager();
  const physics = new Physics(world);
  const playerController = new PlayerController(
    camera,
    inputManager,
    physics,
    world,
  );
  playerController.health = health;

  // 初期位置
  if (savedData?.playerPos) {
    camera.position.set(
      savedData.playerPos.x,
      savedData.playerPos.y,
      savedData.playerPos.z,
    );
  } else {
    camera.position.set(8, 30, 8);
  }

  // ★ 初期チャンクロード
  const initCX = Math.floor(camera.position.x / CHUNK_SIZE);
  const initCZ = Math.floor(camera.position.z / CHUNK_SIZE);
  world.updateChunks(initCX, initCZ);
  console.log(`[boot] 初期チャンクロード完了 chunks=${world.getChunks().size}`);

  // 8. インタラクション
  const raycaster = new BlockRaycaster(camera, scene, world);
  const dropItemManager = new DropItemManager(scene, materialFactory);
  new BlockAction(world, raycaster, dropItemManager, physics, camera);

  // 9. 昼夜サイクル
  const dayNightCycle = new DayNightCycle(
    scene,
    engine.ambientLight,
    engine.directionalLight,
    engine.renderer,
  );

  // 10. パーティクル
  const particleSystem = new ParticleSystem(scene);

  // 11. UI
  const pauseScreen = new PauseScreen(canvas);
  pauseScreen.init(camera);
  inputManager.attach(() => pauseScreen.getIsLocked());

  const hotbarUI = new HotbarUI(textureAtlas, inventory, hotbar);
  const inventoryUI = new InventoryUI(textureAtlas, inventory, hotbar);
  const craftingSystem = new CraftingSystem(inventory);
  const craftingUI = new CraftingUI(textureAtlas, inventory, craftingSystem);
  const uiManager = new UIManager(
    pauseScreen,
    hotbarUI,
    inventoryUI,
    craftingUI,
  );

  // サバイバル HUD
  new HealthBarUI(health);
  new HungerBarUI(hunger);
  new TimeBarUI(dayNightCycle);

  // ミニマップ
  const minimap = new MinimapUI(world, blockRegistry);

  // サウンド
  const soundManager = new SoundManager();

  // 初期描画
  hotbarUI.render();

  // 12. セーブ参照設定
  saveManager.setRefs({ modifiedBlocks, inventory, hotbar });

  // ミニマップ更新カウンター (毎フレームは不要)
  let minimapCounter = 0;

  // 13. ゲームループ
  engine.onUpdate((delta) => {
    try {
      if (pauseScreen.getIsLocked() && !health.isDead) {
        playerController.update(delta);
        hunger.update(delta, inputManager.isRunning);
        // 足音
        const isMoving =
          inputManager.moveForward ||
          inputManager.moveBackward ||
          inputManager.moveLeft ||
          inputManager.moveRight;
        soundManager.updateFootsteps(delta, isMoving, inputManager.isRunning);
      }
      health.update(delta);
      dayNightCycle.update(delta);
      particleSystem.update(delta);
      dropItemManager.update(delta, camera.position);
      world.update(delta); // チャンクメッシュのGPUアップロードキュー消化
      uiManager.update();

      // ミニマップ更新 (10フレームに1回)
      minimapCounter++;
      if (minimapCounter >= 10) {
        minimap.update(camera.position);
        minimapCounter = 0;
      }
    } catch (err) {
      console.error("[GameLoop] Error:", err);
    }
  });

  engine.start();
}

// DOM 準備完了で起動
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
