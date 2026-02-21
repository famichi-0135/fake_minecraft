import * as THREE from "three";
import { SKY_COLOR } from "../core/Constants.js";
import { EventBus } from "../core/EventBus.js";

/**
 * 昼夜サイクル管理
 * 10分 = ゲーム内1日 (昼7分 / 夜3分)
 */
export class DayNightCycle {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.AmbientLight} ambientLight
   * @param {THREE.DirectionalLight} directionalLight
   * @param {THREE.WebGLRenderer} renderer
   */
  constructor(scene, ambientLight, directionalLight, renderer) {
    this.scene = scene;
    this.ambientLight = ambientLight;
    this.directionalLight = directionalLight;
    this.renderer = renderer;

    /** 1日の長さ (秒) */
    this.dayLength = 600; // 10分
    /** 現在の経過時間 (0 ~ dayLength) */
    this.time = 100; // 朝からスタート

    // 色定義
    this._skyDay = new THREE.Color(SKY_COLOR);
    this._skySunset = new THREE.Color(0xff7733);
    this._skyNight = new THREE.Color(0x0a0a2e);
    this._skySunrise = new THREE.Color(0xffaa44);
    this._currentSky = new THREE.Color(SKY_COLOR);
  }

  /**
   * 毎フレーム更新
   * @param {number} delta
   */
  update(delta) {
    this.time = (this.time + delta) % this.dayLength;

    const progress = this.time / this.dayLength; // 0~1

    // フェーズ: 0~0.05 日の出, 0.05~0.45 昼, 0.45~0.55 日没, 0.55~0.95 夜, 0.95~1 日の出
    let skyColor;
    let ambientIntensity;
    let directionalIntensity;

    if (progress < 0.05) {
      // 日の出 (0~0.05)
      const t = progress / 0.05;
      skyColor = this._skyNight.clone().lerp(this._skySunrise, t);
      ambientIntensity = THREE.MathUtils.lerp(0.15, 0.5, t);
      directionalIntensity = THREE.MathUtils.lerp(0.1, 0.5, t);
    } else if (progress < 0.45) {
      // 昼 (0.05~0.45)
      const t = Math.min(1, (progress - 0.05) / 0.1);
      skyColor = this._skySunrise.clone().lerp(this._skyDay, t);
      ambientIntensity = 0.7;
      directionalIntensity = 0.8;
    } else if (progress < 0.55) {
      // 日没 (0.45~0.55)
      const t = (progress - 0.45) / 0.1;
      skyColor = this._skyDay.clone().lerp(this._skySunset, t);
      ambientIntensity = THREE.MathUtils.lerp(0.7, 0.25, t);
      directionalIntensity = THREE.MathUtils.lerp(0.8, 0.2, t);
    } else if (progress < 0.95) {
      // 夜 (0.55~0.95)
      const t = Math.min(1, (progress - 0.55) / 0.1);
      skyColor = this._skySunset.clone().lerp(this._skyNight, t);
      ambientIntensity = 0.15;
      directionalIntensity = 0.1;
    } else {
      // 日の出直前 (0.95~1.0)
      const t = (progress - 0.95) / 0.05;
      skyColor = this._skyNight.clone().lerp(this._skySunrise, t);
      ambientIntensity = THREE.MathUtils.lerp(0.15, 0.5, t);
      directionalIntensity = THREE.MathUtils.lerp(0.1, 0.5, t);
    }

    // 適用
    this.scene.background = skyColor;
    this.scene.fog.color.copy(skyColor);
    this.renderer.setClearColor(skyColor);
    this.ambientLight.intensity = ambientIntensity;
    this.directionalLight.intensity = directionalIntensity;

    // 太陽角度
    const sunAngle = progress * Math.PI * 2;
    this.directionalLight.position.set(
      Math.cos(sunAngle) * 200,
      Math.sin(sunAngle) * 200 + 50,
      100,
    );

    // UIイベント発火
    EventBus.emit("time:changed", {
      progress,
      time: this.time,
      dayLength: this.dayLength,
    });
  }

  /**
   * 昼かどうか
   * @returns {boolean}
   */
  isDaytime() {
    const p = this.time / this.dayLength;
    return p >= 0.05 && p < 0.55;
  }

  /**
   * 表示用の時刻文字列
   * @returns {string}
   */
  getTimeString() {
    const p = this.time / this.dayLength;
    const hours = Math.floor(p * 24) % 24;
    const minutes = Math.floor((p * 24 * 60) % 60);
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  }

  /**
   * アイコン
   * @returns {string}
   */
  getIcon() {
    return this.isDaytime() ? "☀️" : "🌙";
  }
}
