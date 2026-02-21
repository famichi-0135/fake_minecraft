import { EventBus } from "../core/EventBus.js";

/**
 * 時刻表示 HUD
 */
export class TimeBarUI {
  /**
   * @param {import('../world/DayNightCycle.js').DayNightCycle} dayNight
   */
  constructor(dayNight) {
    this.dayNight = dayNight;

    this.el = document.createElement("div");
    this.el.id = "time-bar";
    document.body.appendChild(this.el);

    EventBus.on("time:changed", () => this.render());
    this.render();
  }

  render() {
    this.el.innerHTML = `
      <span class="time-icon">${this.dayNight.getIcon()}</span>
      <span>${this.dayNight.getTimeString()}</span>
    `;
  }
}
