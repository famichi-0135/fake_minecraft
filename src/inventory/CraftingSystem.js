import recipesData from "../data/recipes.json";
import { EventBus } from "../core/EventBus.js";

/**
 * クラフトシステム — レシピ判定・クラフト実行
 */
export class CraftingSystem {
  /**
   * @param {import('./Inventory.js').Inventory} inventory
   */
  constructor(inventory) {
    this.inventory = inventory;
    /** @type {Array} */
    this.recipes = recipesData;
  }

  /**
   * 全レシピと現在の素材充足状況を取得
   * @returns {Array<{ recipe: object, canCraft: boolean }>}
   */
  getRecipeStatus() {
    return this.recipes.map((recipe) => {
      let canCraft = true;
      for (const itemId in recipe.ingredients) {
        if (this.inventory.getCount(itemId) < recipe.ingredients[itemId]) {
          canCraft = false;
          break;
        }
      }
      return { recipe, canCraft };
    });
  }

  /**
   * レシピを実行してクラフトする
   * @param {number} recipeIndex
   * @returns {boolean} 成功
   */
  craft(recipeIndex) {
    const recipe = this.recipes[recipeIndex];
    if (!recipe) return false;

    // 素材チェック
    for (const itemId in recipe.ingredients) {
      if (this.inventory.getCount(itemId) < recipe.ingredients[itemId]) {
        return false;
      }
    }

    // 素材消費
    for (const itemId in recipe.ingredients) {
      this.inventory.consume(itemId, recipe.ingredients[itemId]);
    }

    // 成果物追加
    this.inventory.add(recipe.result.id, recipe.result.count);

    EventBus.emit("world:save");
    return true;
  }
}
