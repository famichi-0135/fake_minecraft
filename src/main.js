// --- スタイル ---
import "../styles/main.css";
import "../styles/hud.css";
import "../styles/inventory.css";
import "../styles/pause.css";
import "../styles/survival.css";
import "../styles/ui-extension.css";
import "../styles/ui-extension.css";

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
import { MapUI } from "./ui/MapUI.js";

// --- Storage ---
import { SaveManager } from "./storage/SaveManager.js";
import { SettingsManager } from "./core/SettingsManager.js";

// --- Math ---
import { setSeed } from "./math/Noise.js";
import { setGlobalSeed } from "./math/Random.js";

// --- Audio ---
import { SoundManager } from "./audio/SoundManager.js";

// --- UI Extension ---
import { TitleScreenUI } from "./ui/TitleScreenUI.js";
import { SettingsUI } from "./ui/SettingsUI.js";

// ===== グローバルインスタンス =====
const saveManager = new SaveManager();
const settingsManager = new SettingsManager();
const soundManager = new SoundManager();

// ===== エントリポイント =====
function init() {
  // --- UI 初期化 ---
  const titleScreen = new TitleScreenUI(saveManager, (worldName) => {
    titleScreen.hide();
    startGameFlow();
  });

  // タイトル画面表示
  titleScreen.show();
}

// ===== ブートストラップ (ゲーム本体) =====
function startGameFlow() {
  const canvas = document.getElementById("game-canvas");

  // HUD等を表示 (タイトル画面では隠しておくべき要素がある場合)
  document.getElementById("crosshair").style.display = "block";
  document.getElementById("toolbar").style.display = "flex";

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
  const savedData = saveManager.load();
  const modifiedBlocks = savedData?.blocks || {};

  // シード値をワールド全体に適用
  const seed = saveManager.getSeed();
  setSeed(seed);
  setGlobalSeed(seed);

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
    seed,
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
    camera.position.set(8, 60, 8);
  }

  // ★ 初期チャンクロード
  const initCX = Math.floor(camera.position.x / CHUNK_SIZE);
  const initCZ = Math.floor(camera.position.z / CHUNK_SIZE);
  world.updateChunks(initCX, initCZ);
  console.log(`[boot] 初期チャンクロード完了 chunks=${world.getChunks().size}`);

  // 水中オーバーレイ要素の動的生成
  const waterOverlay = document.createElement("div");
  waterOverlay.id = "water-overlay";
  document.body.appendChild(waterOverlay);

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

  // 設定・拡張UIの統合
  const settingsUI = new SettingsUI(settingsManager, pauseScreen);
  // SettingsManagerのロード済みの値をイベントとして発火し、各システムへ初期設定を適用
  settingsManager.resetToDefault(); // 一旦デフォルト値で満たす
  settingsManager.load(); // 保存値をロード・上書き
  // EventBus経由でEngine(FOV)やPauseScreen(感度)に通知
  EventBus.emit("settings:changed", settingsManager.get());

  // PauseScreenに直接マウス感度を持たせる（EventBus受信も可能だが確実にするため）
  EventBus.on("settings:changed:mouseSensitivity", (val) => {
    pauseScreen.mouseSensitivity = val;
  });
  pauseScreen.mouseSensitivity = settingsManager.get().mouseSensitivity;

  // 「セーブしてタイトルに戻る」ボタンの挙動
  document
    .getElementById("btn-back-to-title")
    ?.addEventListener("click", () => {
      saveManager.save();
      location.reload(); // 一旦リロードしてタイトル画面に戻す方式
    });

  const hotbarUI = new HotbarUI(textureAtlas, inventory, hotbar);
  const inventoryUI = new InventoryUI(textureAtlas, inventory, hotbar);
  const craftingSystem = new CraftingSystem(inventory);
  const craftingUI = new CraftingUI(textureAtlas, inventory, craftingSystem);
  const mapUI = new MapUI(world, blockRegistry, camera);
  const uiManager = new UIManager(
    pauseScreen,
    hotbarUI,
    inventoryUI,
    craftingUI,
    mapUI,
  );

  // サバイバル HUD
  new HealthBarUI(health);
  new HungerBarUI(hunger);
  new TimeBarUI(dayNightCycle);

  // ミニマップ
  const minimap = new MinimapUI(world, blockRegistry);

  // サウンド (既出のsoundManagerをそのまま使うが、初期設定を反映させる)
  EventBus.emit("settings:changed", settingsManager.get());

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
        inputManager.update(delta);
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

      // 水中オーバーレイ切り替え
      if (playerController.inWater) {
        waterOverlay.classList.add("active");
      } else {
        waterOverlay.classList.remove("active");
      }

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

  // タイトル画面のボタンプッシュ(ユーザー操作)を引き継いで、最初のPointerLockを要求する
  canvas.requestPointerLock();
}

// DOM 準備完了で起動
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
