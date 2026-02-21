import { EventBus } from "../core/EventBus.js";

/**
 * 満腹度バー HUD
 */
export class HungerBarUI {
  /**
   * @param {import('../player/Hunger.js').Hunger} hunger
   */
  constructor(hunger) {
    this.hunger = hunger;

    this.el = document.createElement("div");
    this.el.id = "hunger-bar";
    document.body.appendChild(this.el);

    EventBus.on("hunger:changed", () => this.render());
    this.render();
  }

  render() {
    const h = this.hunger.current;
    const icons = this.hunger.max / 2;
    let html = "";
    for (let i = 0; i < icons; i++) {
      const hForIcon = h - i * 2;
      if (hForIcon >= 2) {
        html += '<span class="hunger-icon full">🍖</span>';
      } else if (hForIcon >= 1) {
        html += '<span class="hunger-icon half">🦴</span>';
      } else {
        html += '<span class="hunger-icon empty">🦴</span>';
      }
    }
    this.el.innerHTML = html;
  }
}
