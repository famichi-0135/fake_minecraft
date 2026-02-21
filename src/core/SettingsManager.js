import { EventBus } from "./EventBus.js";
import { SETTINGS_KEY, DEFAULT_SETTINGS } from "./Constants.js";

/**
 * ゲームの全体設定（グラフィック、感度、音量など）を管理するクラス
 * localStorageで永続化し、EventBus経由で各コンポーネントに変更を通知する。
 */
export class SettingsManager {
  constructor() {
    this.settings = { ...DEFAULT_SETTINGS };
    this.load();
  }

  /**
   * 現在の設定値を取得
   */
  get() {
    return this.settings;
  }

  /**
   * 単一の設定値を更新
   * @param {string} key 設定のキー名
   * @param {any} value 新しい値
   */
  update(key, value) {
    if (this.settings.hasOwnProperty(key)) {
      this.settings[key] = value;
      this.save();
      // 他のコンポーネントに変更を通知
      EventBus.emit(`settings:changed:${key}`, value);
      EventBus.emit("settings:changed", this.settings);
    }
  }

  /**
   * 設定全体を保存
   */
  save() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.warn("SettingsManager: failed to save settings", e);
    }
  }

  /**
   * 設定をロード
   */
  load() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const loaded = JSON.parse(raw);
        // 新しい設定項目が追加された場合などに対応するためマージ
        this.settings = { ...DEFAULT_SETTINGS, ...loaded };
      }
    } catch (e) {
      console.warn("SettingsManager: failed to load settings", e);
    }
  }

  /**
   * 設定をデフォルトに戻す
   */
  resetToDefault() {
    this.settings = { ...DEFAULT_SETTINGS };
    this.save();
    EventBus.emit("settings:changed", this.settings);
  }
}
