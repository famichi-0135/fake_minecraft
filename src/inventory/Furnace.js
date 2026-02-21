import { EventBus } from "../core/EventBus.js";

/**
 * 精錬 (かまど) システム
 */
export class Furnace {
  constructor(inventory) {
    this.inventory = inventory;

    /** 精錬レシピ */
    this.recipes = [
      { input: "iron_ore", output: "iron_ingot", fuel: 1 },
      { input: "gold_ore", output: "gold_ingot", fuel: 1 },
      { input: "sand", output: "glass", fuel: 1 },
      { input: "raw_meat", output: "cooked_meat", fuel: 1 },
      { input: "wood", output: "charcoal", fuel: 0 },
      { input: "cobblestone", output: "stone", fuel: 1 },
    ];

    /** 燃料となるアイテム */
    this.fuels = ["coal_ore", "charcoal", "planks", "wood"];
  }

  /**
   * 精錬可能なレシピ一覧 (所持品ベース)
   */
  getAvailableRecipes() {
    return this.recipes.map((r) => {
      const hasInput = (this.inventory.getCount(r.input) || 0) >= 1;
      const hasFuel =
        r.fuel === 0 ||
        this.fuels.some((f) => (this.inventory.getCount(f) || 0) >= 1);
      return { ...r, canSmelt: hasInput && hasFuel };
    });
  }

  /**
   * 精錬実行
   */
  smelt(recipeInput) {
    const recipe = this.recipes.find((r) => r.input === recipeInput);
    if (!recipe) return false;

    if ((this.inventory.getCount(recipe.input) || 0) < 1) return false;

    // 燃料消費
    if (recipe.fuel > 0) {
      let fuelUsed = false;
      for (const f of this.fuels) {
        if ((this.inventory.getCount(f) || 0) >= 1) {
          this.inventory.consume(f, 1);
          fuelUsed = true;
          break;
        }
      }
      if (!fuelUsed) return false;
    }

    this.inventory.consume(recipe.input, 1);
    this.inventory.add(recipe.output, 1);
    EventBus.emit("furnace:smelted", {
      input: recipe.input,
      output: recipe.output,
    });
    EventBus.emit("world:save");
    return true;
  }
}
