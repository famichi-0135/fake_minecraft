import { EventBus } from "../core/EventBus.js";

/**
 * Web Audio API によるプロシージャル効果音
 * 外部ファイル不要 — 全ての音をリアルタイム生成
 */
export class SoundManager {
  constructor() {
    /** @type {AudioContext|null} */
    this.ctx = null;
    this.enabled = true;
    this.masterGain = null;

    // ユーザー操作後に初期化 (autoplay policy対策)
    this._initOnce = false;

    // 足音タイマー
    this._stepTimer = 0;

    // イベント購読
    EventBus.on("block:destroyed", () => this.play("break"));
    EventBus.on("block:placed", () => this.play("place"));
    EventBus.on("player:damaged", () => this.play("hurt"));
    EventBus.on("item:picked", () => this.play("pickup"));
    EventBus.on("player:died", () => this.play("death"));
  }

  /** AudioContext の遅延初期化 */
  _init() {
    if (this._initOnce) return;
    this._initOnce = true;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.3;
    this.masterGain.connect(this.ctx.destination);
  }

  /**
   * 足音の更新（移動中に呼ぶ）
   * @param {number} delta
   * @param {boolean} isMoving
   * @param {boolean} isRunning
   */
  updateFootsteps(delta, isMoving, isRunning) {
    if (!isMoving) {
      this._stepTimer = 0;
      return;
    }
    this._stepTimer += delta;
    const interval = isRunning ? 0.25 : 0.4;
    if (this._stepTimer >= interval) {
      this.play("step");
      this._stepTimer = 0;
    }
  }

  /**
   * 効果音を再生
   * @param {'break'|'place'|'step'|'hurt'|'pickup'|'death'} type
   */
  play(type) {
    this._init();
    if (!this.enabled || !this.ctx) return;

    const now = this.ctx.currentTime;

    switch (type) {
      case "break":
        this._noise(now, 0.08, 800, 200);
        this._noise(now + 0.03, 0.06, 600, 150);
        break;
      case "place":
        this._tone(now, 0.06, 200, "square", 0.15);
        this._tone(now + 0.04, 0.06, 300, "square", 0.1);
        break;
      case "step":
        this._noise(now, 0.04, 400, 100);
        break;
      case "hurt":
        this._tone(now, 0.15, 300, "sawtooth", 0.2);
        this._tone(now + 0.05, 0.15, 200, "sawtooth", 0.15);
        break;
      case "pickup":
        this._tone(now, 0.08, 600, "sine", 0.1);
        this._tone(now + 0.06, 0.08, 900, "sine", 0.08);
        break;
      case "death":
        this._tone(now, 0.3, 200, "sawtooth", 0.2);
        this._tone(now + 0.1, 0.3, 150, "sawtooth", 0.15);
        this._tone(now + 0.2, 0.4, 100, "sawtooth", 0.1);
        break;
    }
  }

  /** 短いノイズバースト (破壊音・足音) */
  _noise(time, duration, hiFreq, loFreq) {
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(hiFreq, time);
    filter.frequency.linearRampToValueAtTime(loFreq, time + duration);
    filter.Q.value = 1;

    source.connect(filter);
    filter.connect(this.masterGain);
    source.start(time);
  }

  /** トーン生成 (設置音・ダメージ音) */
  _tone(time, duration, freq, waveType, volume) {
    const osc = this.ctx.createOscillator();
    osc.type = waveType;
    osc.frequency.setValueAtTime(freq, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + duration);
  }
}
