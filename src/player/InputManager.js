import { EventBus } from "../core/EventBus.js";

/**
 * キーボード / マウス入力の抽象化
 * 生のイベントを意味ある操作状態に変換する
 */
export class InputManager {
  constructor() {
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.isRunning = false;

    // マウスボタンの状態
    this.isLeftMouseDown = false;
    this.isRightMouseDown = false;
    this.actionCooldown = 0;
    this.ACTION_INTERVAL = 0.2; // 0.2秒ごとに連続アクションをトリガー

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onWheel = this._onWheel.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onContextMenu = this._onContextMenu.bind(this);
  }

  /**
   * イベントリスナーを登録
   * @param {boolean} isLockedFn - PointerLock 状態チェック関数
   */
  attach(isLockedFn) {
    this._isLocked = isLockedFn;
    document.addEventListener("keydown", this._onKeyDown);
    document.addEventListener("keyup", this._onKeyUp);
    document.addEventListener("wheel", this._onWheel, { passive: false });
    document.addEventListener("mousedown", this._onMouseDown);
    document.addEventListener("mouseup", this._onMouseUp);
    document.addEventListener("contextmenu", this._onContextMenu);
  }

  /**
   * イベントリスナーを解除
   */
  detach() {
    document.removeEventListener("keydown", this._onKeyDown);
    document.removeEventListener("keyup", this._onKeyUp);
    document.removeEventListener("wheel", this._onWheel);
    document.removeEventListener("mousedown", this._onMouseDown);
    document.removeEventListener("mouseup", this._onMouseUp);
    document.removeEventListener("contextmenu", this._onContextMenu);
  }

  _onKeyDown(event) {
    // インベントリ表示中は E キー以外無視
    EventBus.emit("input:keydown", { code: event.code, key: event.key });

    switch (event.code) {
      case "ArrowUp":
      case "KeyW":
        this.moveForward = true;
        break;
      case "ArrowLeft":
      case "KeyA":
        this.moveLeft = true;
        break;
      case "ArrowDown":
      case "KeyS":
        this.moveBackward = true;
        break;
      case "ArrowRight":
      case "KeyD":
        this.moveRight = true;
        break;
      case "Space":
        EventBus.emit("input:jump");
        break;
      case "ShiftLeft":
      case "ShiftRight":
        this.isRunning = true;
        break;
      case "KeyE":
        EventBus.emit("input:toggle-inventory");
        break;
      case "KeyM":
        EventBus.emit("input:toggle-map");
        break;
      case "Digit1":
      case "Digit2":
      case "Digit3":
      case "Digit4":
      case "Digit5":
      case "Digit6":
      case "Digit7":
      case "Digit8":
      case "Digit9":
      case "Digit0": {
        const index = event.code === "Digit0" ? 9 : parseInt(event.key) - 1;
        EventBus.emit("slot:selected", { index });
        break;
      }
    }
  }

  _onKeyUp(event) {
    switch (event.code) {
      case "ArrowUp":
      case "KeyW":
        this.moveForward = false;
        break;
      case "ArrowLeft":
      case "KeyA":
        this.moveLeft = false;
        break;
      case "ArrowDown":
      case "KeyS":
        this.moveBackward = false;
        break;
      case "ArrowRight":
      case "KeyD":
        this.moveRight = false;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        this.isRunning = false;
        break;
    }
  }

  _onWheel(event) {
    if (!this._isLocked()) return;
    const direction = event.deltaY > 0 ? 1 : -1;
    EventBus.emit("slot:scroll", { direction });
  }

  _onMouseDown(event) {
    if (!this._isLocked()) return;
    if (event.button === 0) {
      this.isLeftMouseDown = true;
      EventBus.emit("input:attack"); // 初回は即時発動
      this.actionCooldown = this.ACTION_INTERVAL;
    } else if (event.button === 2) {
      this.isRightMouseDown = true;
      EventBus.emit("input:use"); // 初回は即時発動
      this.actionCooldown = this.ACTION_INTERVAL;
    }
  }

  _onMouseUp(event) {
    if (event.button === 0) {
      this.isLeftMouseDown = false;
      EventBus.emit("input:attack-stop");
    } else if (event.button === 2) {
      this.isRightMouseDown = false;
    }
  }

  _onContextMenu(event) {
    if (this._isLocked()) event.preventDefault();
  }

  /**
   * 毎フレームの入力状態の更新 (長押しの連続アクション発動)
   * @param {number} delta - 経過秒
   */
  update(delta) {
    if (!this._isLocked()) {
      // ロックが外れたらマウス押下状態などをリセット
      this.isLeftMouseDown = false;
      this.isRightMouseDown = false;
      return;
    }

    // クールダウン更新
    if (this.actionCooldown > 0) {
      this.actionCooldown -= delta;
    } else {
      // クールダウンがゼロになり、さらに押しっぱなしの場合は再度アクション発動
      if (this.isLeftMouseDown) {
        EventBus.emit("input:attack");
        this.actionCooldown = this.ACTION_INTERVAL;
      } else if (this.isRightMouseDown) {
        EventBus.emit("input:use");
        this.actionCooldown = this.ACTION_INTERVAL;
      }
    }
  }
}
