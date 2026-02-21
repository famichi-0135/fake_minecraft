import { EventBus } from "../core/EventBus.js";

/**
 * 空腹 (満腹度) 管理
 */
export class Hunger {
  /**
   * @param {import('./Health.js').Health} health
   * @param {number} max
   */
  constructor(health, max = 20) {
    this.health = health;
    this.max = max;
    this.current = max;

    /** 満腹度がこの値以上なら自然回復 */
    this.healThreshold = 18;
    this._healTimer = 0;
    this._starvationTimer = 0;

    // 走行中の消費を追跡
    this._sprintTimer = 0;

    // ジャンプで消費
    EventBus.on("input:jump", () => {
      this.consume(0.001);
    });
  }

  /**
   * 毎フレーム更新
   * @param {number} delta
   * @param {boolean} isSprinting
   */
  update(delta, isSprinting) {
    // 走行で消費
    if (isSprinting) {
      this._sprintTimer += delta;
      if (this._sprintTimer >= 1.0) {
        this.consume(0.001);
        this._sprintTimer = 0;
      }
    }

    // 満腹時: 自然回復
    if (
      this.current >= this.healThreshold &&
      this.health.current < this.health.max
    ) {
      this._healTimer += delta;
      if (this._healTimer >= 4.0) {
        this.health.heal(1);
        this.consume(0.001);
        this._healTimer = 0;
      }
    } else {
      this._healTimer = 0;
    }

    // 飢え: HP減少
    if (this.current <= 0) {
      this._starvationTimer += delta;
      if (this._starvationTimer >= 8.0) {
        this.health.damage(1, "hunger");
        this._starvationTimer = 0;
      }
    } else {
      this._starvationTimer = 0;
    }
  }

  /**
   * 満腹度を消費
   * @param {number} amount
   */
  consume(amount) {
    this.current = Math.max(0, this.current - amount);
    EventBus.emit("hunger:changed", { hunger: this.current, max: this.max });
  }

  /**
   * 食べ物で回復
   * @param {number} amount
   */
  feed(amount) {
    this.current = Math.min(this.max, this.current + amount);
    EventBus.emit("hunger:changed", { hunger: this.current, max: this.max });
  }

  /**
   * リスポーン時のリセット
   */
  reset() {
    this.current = this.max;
    EventBus.emit("hunger:changed", { hunger: this.current, max: this.max });
  }
}
