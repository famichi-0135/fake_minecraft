/**
 * 設定画面のUI制御
 */
export class SettingsUI {
  /**
   * @param {import('../core/SettingsManager.js').SettingsManager} settingsManager
   * @param {import('./PauseScreen.js').PauseScreen} pauseScreen
   */
  constructor(settingsManager, pauseScreen) {
    this.settingsManager = settingsManager;
    this.pauseScreen = pauseScreen;

    this.container = document.getElementById("settings-ui");

    // UI Elements
    this.slVolume = document.getElementById("slider-volume");
    this.valVolume = document.getElementById("val-volume");
    this.slSensitivity = document.getElementById("slider-sensitivity");
    this.valSensitivity = document.getElementById("val-sensitivity");
    this.slFov = document.getElementById("slider-fov");
    this.valFov = document.getElementById("val-fov");
    this.slRenderDist = document.getElementById("slider-render-dist");
    this.valRenderDist = document.getElementById("val-render-dist");

    this.btnReset = document.getElementById("btn-reset-settings");
    this.btnClose = document.getElementById("btn-close-settings");

    // ポーズ画面からの呼び出し用ボタン
    this.btnOpenSettings = document.getElementById("btn-open-settings");

    this._bindEvents();
    this._syncUI();
  }

  _bindEvents() {
    this.btnOpenSettings.addEventListener("click", () => this.show());
    this.btnClose.addEventListener("click", () => this.hide());

    // ESCで閉じる（UIManagerなどのイベントと競合しないよう注意しつつ簡易実装）
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isOpen()) {
        this.hide();
      }
    });

    this.btnReset.addEventListener("click", () => {
      if (confirm("設定をすべて初期状態に戻しますか？")) {
        this.settingsManager.resetToDefault();
        this._syncUI();
      }
    });

    // スライダー変更イベント (リアルタイム反映)
    this.slVolume.addEventListener("input", (e) => {
      const vol = parseInt(e.target.value);
      this.valVolume.innerText = vol;
      this.settingsManager.update("masterVolume", vol / 100);
    });

    this.slSensitivity.addEventListener("input", (e) => {
      const sense = parseInt(e.target.value);
      this.valSensitivity.innerText = sense;
      // 表示上は1〜100、内部値は 0.0001〜0.01 程度の範囲にマッピング
      const mapped = sense * 0.0001;
      this.settingsManager.update("mouseSensitivity", mapped);
    });

    this.slFov.addEventListener("input", (e) => {
      const fov = parseInt(e.target.value);
      this.valFov.innerText = fov;
      this.settingsManager.update("fov", fov);
    });

    // 描画距離は現在ブロックされているが、将来のためのバインディング
    this.slRenderDist.addEventListener("input", (e) => {
      const dist = parseInt(e.target.value);
      this.valRenderDist.innerText = dist;
      this.settingsManager.update("renderDistance", dist);
    });
  }

  isOpen() {
    return this.container.style.display === "flex";
  }

  show() {
    // ポーズ画面を維持しつつ設定画面を前面に出す
    const blocker = document.getElementById("blocker");
    if (blocker) blocker.style.display = "none";

    this._syncUI();
    this.container.style.display = "flex";
  }

  hide() {
    this.container.style.display = "none";
    // 閉じたらポーズ画面に戻るフロー
    const blocker = document.getElementById("blocker");
    if (blocker) blocker.style.display = "flex";
  }

  _syncUI() {
    const s = this.settingsManager.get();

    this.slVolume.value = Math.round(s.masterVolume * 100);
    this.valVolume.innerText = this.slVolume.value;

    // 内部値を 1〜100 の表示スケールに戻す (0.002 -> 20)
    // 丸め誤差対策で Math.round を使用
    this.slSensitivity.value = Math.max(
      1,
      Math.min(100, Math.round(s.mouseSensitivity * 10000)),
    );
    this.valSensitivity.innerText = this.slSensitivity.value;

    this.slFov.value = s.fov;
    this.valFov.innerText = s.fov;

    if (s.renderDistance) {
      this.slRenderDist.value = s.renderDistance;
      this.valRenderDist.innerText = s.renderDistance;
    }
  }
}
