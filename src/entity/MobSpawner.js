import { Pig } from "./mobs/Pig.js";
import { Zombie } from "./mobs/Zombie.js";
import { BOTTOM_Y } from "../core/Constants.js";

/**
 * モブの自然スポーン・デスポーンを管理するクラス
 */
export class MobSpawner {
  /**
   * @param {import('../world/World.js').World} world
   * @param {import('../player/Physics.js').Physics} physics
   * @param {THREE.Scene} scene
   * @param {import('./EntityManager.js').EntityManager} entityManager
   * @param {import('../player/PlayerController.js').PlayerController} player
   * @param {import('../world/DayNightCycle.js').DayNightCycle} dayNightCycle
   */
  constructor(world, physics, scene, entityManager, player, dayNightCycle) {
    this.world = world;
    this.physics = physics;
    this.scene = scene;
    this.entityManager = entityManager;
    this.player = player;
    this.dayNightCycle = dayNightCycle;

    this.spawnTimer = 0;
    this.spawnInterval = 2.0; // 判定間隔（秒）

    // ゲーム内の最大存在数（プレイヤー周辺）
    this.maxPigs = 10;
    this.maxZombies = 12;

    // スポーン距離（近すぎず、遠すぎず）
    this.minDist = 24;
    this.maxDist = 64;
  }

  update(delta) {
    this.spawnTimer += delta;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.attemptSpawn();
    }
  }

  attemptSpawn() {
    let pigCount = 0;
    let zombieCount = 0;

    // 現在のモブ数をカウント
    for (const entity of this.entityManager.entities) {
      if (entity instanceof Pig) pigCount++;
      if (entity instanceof Zombie) zombieCount++;
    }

    // 時間帯の取得 (0.0~1.0)
    const progress = this.dayNightCycle.time / this.dayNightCycle.dayLength;
    // 0.45(日没) 〜 0.95(夜明け前) を夜とする
    const isNight = progress >= 0.45 && progress < 0.95;

    // 確率でブタをスポーン
    if (pigCount < this.maxPigs) {
      if (Math.random() < 0.3) {
        this.spawnMob(Pig);
      }
    }

    // 夜間のみ、確率でゾンビをスポーン
    if (isNight && zombieCount < this.maxZombies) {
      if (Math.random() < 0.4) {
        this.spawnMob(Zombie);
      }
    }

    // プレイヤーから離れすぎたモブをデスポーン（消去）する
    this.despawnFarMobs();
  }

  despawnFarMobs() {
    const playerPos = this.player.camera.position;
    for (const entity of this.entityManager.entities) {
      // 一定距離(100ブロック)以上離れたモブは自動的に死亡(デスポーン)扱いにする
      const dist = entity.position.distanceTo(playerPos);
      if (dist > 100) {
        entity.die();
      }
    }
  }

  spawnMob(MobClass) {
    const playerPos = this.player.camera.position;
    const angle = Math.random() * Math.PI * 2;
    const dist = this.minDist + Math.random() * (this.maxDist - this.minDist);

    const x = Math.floor(playerPos.x + Math.cos(angle) * dist);
    const z = Math.floor(playerPos.z + Math.sin(angle) * dist);

    // チャンクがロード済みか確認（未ロードのチャンクだと空中落下して即死するためスキップ）
    const cx = Math.floor(x / 16);
    const cz = Math.floor(z / 16);
    if (!this.world.isChunkLoaded(cx, cz)) {
      return;
    }

    // スポーンさせるY座標を探す（空から下に向かって最初の個体ブロック）
    let spawnY = null;
    for (let y = 100; y >= BOTTOM_Y; y--) {
      const type = this.world.getSolidBlockType(x, y, z);
      if (type && type !== "water" && type !== "lava") {
        // 水やマグマの上にはスポーンしない
        spawnY = y + 1;
        break;
      }
    }

    // スポーン座標が見つかればインスタンス化して追加
    if (spawnY !== null) {
      let mob;
      if (MobClass === Zombie) {
        mob = new Zombie(this.world, this.physics, this.scene, this.player);
      } else {
        mob = new Pig(this.world, this.physics, this.scene);
      }
      mob.position.set(x + 0.5, spawnY, z + 0.5);
      this.entityManager.add(mob);
    }
  }
}
