import * as THREE from "three";
import { SKY_COLOR, CHUNK_SIZE, RENDER_DISTANCE } from "./Constants.js";

/**
 * Three.js シーン・カメラ・レンダラー管理 + ゲームループ
 */
export class Engine {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;

    // レンダラー
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(SKY_COLOR);

    // シーン
    this.scene = new THREE.Scene();

    // RENDER_DISTANCEに基づく動的なFogの適用
    const maxVisibleDistance = RENDER_DISTANCE * CHUNK_SIZE;
    const fogNear = Math.max(0, maxVisibleDistance - 3 * CHUNK_SIZE);
    const fogFar = maxVisibleDistance;

    this.scene.fog = new THREE.Fog(SKY_COLOR, fogNear, fogFar);
    this.scene.background = new THREE.Color(SKY_COLOR);

    // カメラ
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    this.camera.rotation.order = "YXZ";

    // ライティング
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(this.ambientLight);
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.directionalLight.position.set(100, 200, 100);
    this.scene.add(this.directionalLight);

    // リサイズ対応
    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    /** @type {function[]} */
    this._updateCallbacks = [];
    this._clock = new THREE.Clock();
    this._running = false;
    this._rafId = null;
  }

  getScene() {
    return this.scene;
  }
  getCamera() {
    return this.camera;
  }

  /**
   * 毎フレーム呼ばれるコールバックを登録
   * @param {function(number): void} callback - delta秒が引数
   */
  onUpdate(callback) {
    this._updateCallbacks.push(callback);
  }

  /**
   * ゲームループ開始
   */
  start() {
    this._running = true;
    this._clock.start();
    this._tick();
  }

  /**
   * ゲームループ停止
   */
  stop() {
    this._running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
  }

  _tick() {
    if (!this._running) return;
    this._rafId = requestAnimationFrame(() => this._tick());
    let delta = this._clock.getDelta();
    if (delta > 0.1) delta = 0.1; // 大きなスパイクを防止

    try {
      for (const cb of this._updateCallbacks) {
        cb(delta);
      }
    } catch (err) {
      console.error("[Engine._tick] Error:", err);
    }

    this.renderer.render(this.scene, this.camera);
  }
}
