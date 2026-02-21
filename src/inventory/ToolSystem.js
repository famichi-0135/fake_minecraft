import toolsData from "../data/tools.json";
import { EventBus } from "../core/EventBus.js";

/**
 * ツールシステム — 採掘速度・耐久値・ティア管理
 */
export class ToolSystem {
  constructor(inventory) {
    this.inventory = inventory;
    this.tools = toolsData.tools;
    this.tiers = toolsData.tiers;
    this.miningTierRequired = toolsData.miningTierRequired;

    // ツール耐久度 { toolId: remaining }
    this.durability = {};
  }

  /**
   * ツールIDからツール定義を取得
   */
  getToolDef(toolId) {
    return this.tools.find((t) => t.id === toolId) || null;
  }

  /**
   * ツールのクラフトレシピを全て取得
   */
  getRecipes() {
    return this.tools.map((t) => ({
      ingredients: t.recipe,
      result: { id: t.id, count: 1 },
      label: t.name,
    }));
  }

  /**
   * 指定アイテムがツールかどうか
   */
  isTool(itemId) {
    return this.tools.some((t) => t.id === itemId);
  }

  /**
   * 現在手持ちのツール採掘速度倍率
   */
  getMiningSpeed(toolId) {
    const def = this.getToolDef(toolId);
    return def ? def.speedMultiplier : 1;
  }

  /**
   * ブロックを掘れるか (ティアチェック)
   */
  canMine(blockType, toolId) {
    const required = this.miningTierRequired[blockType];
    if (!required) return true;
    if (!toolId) return false;
    const def = this.getToolDef(toolId);
    if (!def || def.type !== "pickaxe") return false;
    return this.tiers.indexOf(def.tier) >= this.tiers.indexOf(required);
  }

  /**
   * ツールの耐久値を消費
   */
  useTool(toolId) {
    if (!toolId) return;
    if (this.durability[toolId] === undefined) {
      const def = this.getToolDef(toolId);
      if (def) this.durability[toolId] = def.durability;
    }
    this.durability[toolId]--;
    if (this.durability[toolId] <= 0) {
      this.inventory.consume(toolId, 1);
      delete this.durability[toolId];
      EventBus.emit("tool:broken", { id: toolId });
    }
    EventBus.emit("tool:durability", {
      id: toolId,
      remaining: this.durability[toolId] || 0,
    });
  }

  /**
   * 耐久値の割合
   */
  getDurabilityRatio(toolId) {
    const def = this.getToolDef(toolId);
    if (!def) return 1;
    const remaining = this.durability[toolId] ?? def.durability;
    return remaining / def.durability;
  }
}
