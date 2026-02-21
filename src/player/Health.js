import { EventBus } from "../core/EventBus.js";

/**
 * プレイヤー体力管理
 */
export class Health {
  /**
   * @param {number} max - 最大HP (デフォルト20)
   */
  constructor(max = 20) {
    this.max = max;
    this.current = max;
    this.isDead = false;

    // 落下ダメージ追跡
    this._lastGroundedY = null;
    this._isGrounded = false;

    // ダメージ無敵時間
    this._invincibleTimer = 0;

    // リスポーンイベント
    EventBus.on("player:respawn", () => this.respawn());
  }

  /**
   * 毎フレーム更新
   * @param {number} delta
   */
  update(delta) {
    if (this._invincibleTimer > 0) {
      this._invincibleTimer -= delta;
    }
  }

  /**
   * ダメージを受ける
   * @param {number} amount
   * @param {string} source - ダメージ源 ('fall', 'hunger', 'void')
   */
  damage(amount, source = "unknown") {
    if (this.isDead || this._invincibleTimer > 0) return;

    this.current = Math.max(0, this.current - amount);
    this._invincibleTimer = 0.5; // 0.5秒の無敵時間

    EventBus.emit("player:damaged", {
      hp: this.current,
      max: this.max,
      amount,
      source,
    });

    if (this.current <= 0) {
      this._die();
    }
  }

  /**
   * 回復
   * @param {number} amount
   */
  heal(amount) {
    if (this.isDead) return;
    this.current = Math.min(this.max, this.current + amount);
    EventBus.emit("health:changed", { hp: this.current, max: this.max });
  }

  /**
   * 着地時の落下ダメージ判定
   * @param {number} fallStartY - 落下開始Y
   * @param {number} landY - 着地Y
   */
  checkFallDamage(fallStartY, landY) {
    if (fallStartY === null) return;
    const fallDistance = fallStartY - landY;
    // 6ブロック以上で落下ダメージ (緩和済み)
    if (fallDistance > 6) {
      const dmg = Math.max(1, Math.floor((fallDistance - 6) * 1));
      this.damage(dmg, "fall");
    }
  }

  /**
   * リスポーン
   */
  respawn() {
    this.current = this.max;
    this.isDead = false;
    this._invincibleTimer = 5.0; // リスポーン後5秒無敵 (初回の落下対策)
    EventBus.emit("health:changed", { hp: this.current, max: this.max });
  }

  /** @private */
  _die() {
    this.isDead = true;
    EventBus.emit("player:died");
  }
}
