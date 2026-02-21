import { EventBus } from "../core/EventBus.js";

/**
 * ポーズ画面 / PointerLock 管理
 */
export class PauseScreen {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.blockerEl = document.getElementById("blocker");
    this.instructionsEl = document.getElementById("instructions");
    this.resetBtn = document.getElementById("reset-btn");

    /** @type {boolean} */
    this.isLocked = false;
    /** @type {boolean} 一時ロック解除フラグ (インベントリ表示中) */
    this.pausedForUI = false;

    this._onPointerLockChange = this._onPointerLockChange.bind(this);
    this._onPointerLockError = this._onPointerLockError.bind(this);
    this._boundOnMouseMove = this._onMouseMove.bind(this);
  }

  /**
   * 初期化・イベント登録
   * @param {THREE.Camera} camera
   */
  init(camera) {
    this.camera = camera;

    // PointerLock
    document.addEventListener("pointerlockchange", this._onPointerLockChange);
    document.addEventListener("pointerlockerror", this._onPointerLockError);

    // クリックでゲーム開始
    this.instructionsEl.addEventListener("click", (e) => {
      // "ゲームに戻る" ボタンの場合はロック取得を許可する
      if (e.target.closest("#btn-resume-game")) {
        this.canvas.requestPointerLock();
        return;
      }

      // それ以外のUIボタンなどをクリックした場合はロック取得をスキップ
      if (e.target.closest("button") || e.target.closest("input")) return;

      this.canvas.requestPointerLock();
    });

    // リセットボタン
    if (this.resetBtn) {
      this.resetBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        EventBus.emit("world:reset");
      });
    }
  }

  /**
   * PointerLock 状態を返す
   * @returns {boolean}
   */
  getIsLocked() {
    return this.isLocked;
  }

  /**
   * UI用の一時ロック解除
   */
  pauseForUI() {
    this.pausedForUI = true;
    document.exitPointerLock();
  }

  /**
   * UI閉じた後のロック再取得
   */
  resumeFromUI() {
    this.pausedForUI = false;
    this.canvas.requestPointerLock();
  }

  _onPointerLockChange() {
    if (document.pointerLockElement === this.canvas) {
      this.isLocked = true;
      this.blockerEl.style.display = "none";
      document.addEventListener("mousemove", this._boundOnMouseMove, false);
    } else {
      this.isLocked = false;
      document.removeEventListener("mousemove", this._boundOnMouseMove, false);
      if (!this.pausedForUI) {
        this.blockerEl.style.display = "flex";
      }
    }
  }

  _onPointerLockError() {
    console.error(
      "PointerLock Error. User needs to interact with the document first.",
    );
    this.isLocked = false;
    if (!this.pausedForUI) {
      this.blockerEl.style.display = "flex";
    }
  }

  _onMouseMove(event) {
    if (!this.camera) return;
    const euler = this.camera.rotation;
    // this.mouseSensitivity は main.js 側で EventBus/SettingsManager から初期化・更新される
    const sensitivity = this.mouseSensitivity || 0.002;
    euler.y -= event.movementX * sensitivity;
    euler.x -= event.movementY * sensitivity;
    euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
  }
}
