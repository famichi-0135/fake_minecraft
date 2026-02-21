/**
 * 軽量 Pub/Sub イベントバス
 * モジュール間の疎結合通信に使用する
 */
const listeners = new Map();

export const EventBus = {
  /**
   * イベントを購読する
   * @param {string} event - イベント名 (例: 'block:destroyed')
   * @param {function} handler - コールバック関数
   */
  on(event, handler) {
    if (!listeners.has(event)) {
      listeners.set(event, []);
    }
    listeners.get(event).push(handler);
  },

  /**
   * イベント購読を解除する
   * @param {string} event
   * @param {function} handler
   */
  off(event, handler) {
    const handlers = listeners.get(event);
    if (handlers) {
      const idx = handlers.indexOf(handler);
      if (idx !== -1) handlers.splice(idx, 1);
    }
  },

  /**
   * イベントを発火する
   * @param {string} event
   * @param {*} data - ハンドラに渡すデータ
   */
  emit(event, data) {
    const handlers = listeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  },
};
