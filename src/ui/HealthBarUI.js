import { EventBus } from "../core/EventBus.js";

/**
 * 体力バー HUD — ハートアイコンで表示
 */
export class HealthBarUI {
  /**
   * @param {import('../player/Health.js').Health} health
   */
  constructor(health) {
    this.health = health;

    // コンテナ作成
    this.el = document.createElement("div");
    this.el.id = "health-bar";
    document.body.appendChild(this.el);

    // ダメージフラッシュ用オーバーレイ
    this.flashEl = document.createElement("div");
    this.flashEl.id = "damage-flash";
    document.body.appendChild(this.flashEl);

    // 死亡画面
    this.deathScreen = document.createElement("div");
    this.deathScreen.id = "death-screen";
    this.deathScreen.innerHTML = `
      <div class="death-content">
        <h1>YOU DIED</h1>
        <button id="respawn-btn" class="btn-primary">リスポーン</button>
      </div>
    `;
    this.deathScreen.style.display = "none";
    document.body.appendChild(this.deathScreen);

    this.deathScreen
      .querySelector("#respawn-btn")
      .addEventListener("click", () => {
        EventBus.emit("player:respawn");
        this.deathScreen.style.display = "none";
      });

    // イベント購読
    EventBus.on("health:changed", () => this.render());
    EventBus.on("player:damaged", ({ source }) => this._showDamageFlash());
    EventBus.on("player:died", () => this._showDeathScreen());

    this.render();
  }

  render() {
    const hp = this.health.current;
    const max = this.health.max;
    const hearts = max / 2; // 10ハート

    let html = "";
    for (let i = 0; i < hearts; i++) {
      const hpForThisHeart = hp - i * 2;
      if (hpForThisHeart >= 2) {
        html += '<span class="heart full">❤</span>';
      } else if (hpForThisHeart >= 1) {
        html += '<span class="heart half">💔</span>';
      } else {
        html += '<span class="heart empty">🖤</span>';
      }
    }
    this.el.innerHTML = html;
  }

  _showDamageFlash() {
    this.flashEl.classList.add("active");
    setTimeout(() => this.flashEl.classList.remove("active"), 200);
  }

  _showDeathScreen() {
    this.deathScreen.style.display = "flex";
  }
}
