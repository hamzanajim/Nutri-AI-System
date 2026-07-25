export interface FoodEntry {
  name: string;
  aliases?: string[];
  category: "protein" | "carbs" | "vegetables" | "fruits" | "dairy" | "fats" | "pantry" | "drinks" | "supplements";
  defaultUnit: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
}

export const NUTRITION_DB: FoodEntry[] = [
  // ── Protein ──────────────────────────────────────────────────────────────────
  { name: "Chicken Breast", aliases: ["chicken breast", "chicken"], category: "protein", defaultUnit: "g", caloriesPer100g: 165, proteinPer100g: 31, carbsPer100g: 0, fatPer100g: 3.6 },
  { name: "Chicken Thigh", aliases: ["chicken thigh"], category: "protein", defaultUnit: "g", caloriesPer100g: 209, proteinPer100g: 26, carbsPer100g: 0, fatPer100g: 11 },
  { name: "Chicken Wings", aliases: ["chicken wings"], category: "protein", defaultUnit: "g", caloriesPer100g: 290, proteinPer100g: 27, carbsPer100g: 0, fatPer100g: 19 },
  { name: "Ground Chicken", aliases: ["ground chicken", "minced chicken"], category: "protein", defaultUnit: "g", caloriesPer100g: 172, proteinPer100g: 19, carbsPer100g: 0, fatPer100g: 10 },
  { name: "Ground Beef", aliases: ["ground beef", "minced beef", "beef mince"], category: "protein", defaultUnit: "g", caloriesPer100g: 250, proteinPer100g: 26, carbsPer100g: 0, fatPer100g: 15 },
  { name: "Beef Steak", aliases: ["steak", "beef steak", "sirloin"], category: "protein", defaultUnit: "g", caloriesPer100g: 271, proteinPer100g: 26, carbsPer100g: 0, fatPer100g: 18 },
  { name: "Salmon Fillet", aliases: ["salmon", "salmon fillet"], category: "protein", defaultUnit: "g", caloriesPer100g: 208, proteinPer100g: 20, carbsPer100g: 0, fatPer100g: 13 },
  { name: "Tuna", aliases: ["tuna", "tuna canned", "canned tuna"], category: "protein", defaultUnit: "g", caloriesPer100g: 116, proteinPer100g: 26, carbsPer100g: 0, fatPer100g: 1 },
  { name: "Cod Fillet", aliases: ["cod", "cod fillet"], category: "protein", defaultUnit: "g", caloriesPer100g: 82, proteinPer100g: 18, carbsPer100g: 0, fatPer100g: 0.7 },
  { name: "Shrimp", aliases: ["shrimp", "prawns", "prawns"], category: "protein", defaultUnit: "g", caloriesPer100g: 99, proteinPer100g: 24, carbsPer100g: 0.2, fatPer100g: 0.3 },
  { name: "Eggs", aliases: ["egg", "eggs"], category: "protein", defaultUnit: "pieces", caloriesPer100g: 155, proteinPer100g: 13, carbsPer100g: 1.1, fatPer100g: 11 },
  { name: "Egg Whites", aliases: ["egg white", "egg whites"], category: "protein", defaultUnit: "ml", caloriesPer100g: 52, proteinPer100g: 11, carbsPer100g: 0.7, fatPer100g: 0.2 },
  { name: "Turkey Breast", aliases: ["turkey breast", "turkey"], category: "protein", defaultUnit: "g", caloriesPer100g: 135, proteinPer100g: 30, carbsPer100g: 0, fatPer100g: 1 },
  { name: "Pork Tenderloin", aliases: ["pork", "pork tenderloin"], category: "protein", defaultUnit: "g", caloriesPer100g: 143, proteinPer100g: 26, carbsPer100g: 0, fatPer100g: 4 },
  { name: "Tofu", aliases: ["tofu", "firm tofu"], category: "protein", defaultUnit: "g", caloriesPer100g: 76, proteinPer100g: 8, carbsPer100g: 1.9, fatPer100g: 4.8 },
  { name: "Tempeh", aliases: ["tempeh"], category: "protein", defaultUnit: "g", caloriesPer100g: 193, proteinPer100g: 19, carbsPer100g: 9, fatPer100g: 11 },
  { name: "Edamame", aliases: ["edamame"], category: "protein", defaultUnit: "g", caloriesPer100g: 121, proteinPer100g: 11, carbsPer100g: 8.9, fatPer100g: 5.2 },

  // ── Carbohydrates ─────────────────────────────────────────────────────────────
  { name: "Brown Rice", aliases: ["brown rice"], category: "carbs", defaultUnit: "g", caloriesPer100g: 362, proteinPer100g: 7.5, carbsPer100g: 76, fatPer100g: 2.7 },
  { name: "White Rice", aliases: ["white rice", "rice"], category: "carbs", defaultUnit: "g", caloriesPer100g: 365, proteinPer100g: 7, carbsPer100g: 80, fatPer100g: 0.7 },
  { name: "Oats", aliases: ["oats", "rolled oats", "oatmeal"], category: "carbs", defaultUnit: "g", caloriesPer100g: 389, proteinPer100g: 17, carbsPer100g: 66, fatPer100g: 7 },
  { name: "Quinoa", aliases: ["quinoa"], category: "carbs", defaultUnit: "g", caloriesPer100g: 368, proteinPer100g: 14, carbsPer100g: 64, fatPer100g: 6 },
  { name: "Sweet Potato", aliases: ["sweet potato", "sweet potatoes"], category: "carbs", defaultUnit: "g", caloriesPer100g: 86, proteinPer100g: 1.6, carbsPer100g: 20, fatPer100g: 0.1 },
  { name: "White Potato", aliases: ["potato", "potatoes", "white potato"], category: "carbs", defaultUnit: "g", caloriesPer100g: 77, proteinPer100g: 2, carbsPer100g: 17, fatPer100g: 0.1 },
  { name: "Whole Wheat Pasta", aliases: ["whole wheat pasta", "pasta", "whole grain pasta"], category: "carbs", defaultUnit: "g", caloriesPer100g: 348, proteinPer100g: 13, carbsPer100g: 68, fatPer100g: 2.5 },
  { name: "White Pasta", aliases: ["white pasta"], category: "carbs", defaultUnit: "g", caloriesPer100g: 371, proteinPer100g: 13, carbsPer100g: 75, fatPer100g: 1.5 },
  { name: "Whole Grain Bread", aliases: ["whole grain bread", "whole wheat bread", "wholegrain bread"], category: "carbs", defaultUnit: "slices", caloriesPer100g: 247, proteinPer100g: 13, carbsPer100g: 43, fatPer100g: 4 },
  { name: "Sourdough Bread", aliases: ["sourdough", "sourdough bread"], category: "carbs", defaultUnit: "slices", caloriesPer100g: 274, proteinPer100g: 9, carbsPer100g: 53, fatPer100g: 2 },
  { name: "Lentils", aliases: ["lentils", "red lentils", "green lentils"], category: "carbs", defaultUnit: "g", caloriesPer100g: 353, proteinPer100g: 26, carbsPer100g: 60, fatPer100g: 1.1 },
  { name: "Black Beans", aliases: ["black beans"], category: "carbs", defaultUnit: "g", caloriesPer100g: 341, proteinPer100g: 21, carbsPer100g: 62, fatPer100g: 1.4 },
  { name: "Chickpeas", aliases: ["chickpeas", "garbanzo beans"], category: "carbs", defaultUnit: "g", caloriesPer100g: 364, proteinPer100g: 19, carbsPer100g: 61, fatPer100g: 6 },

  // ── Vegetables ───────────────────────────────────────────────────────────────
  { name: "Spinach", aliases: ["spinach", "baby spinach"], category: "vegetables", defaultUnit: "g", caloriesPer100g: 23, proteinPer100g: 2.9, carbsPer100g: 3.6, fatPer100g: 0.4 },
  { name: "Broccoli", aliases: ["broccoli"], category: "vegetables", defaultUnit: "g", caloriesPer100g: 34, proteinPer100g: 2.8, carbsPer100g: 7, fatPer100g: 0.4 },
  { name: "Kale", aliases: ["kale"], category: "vegetables", defaultUnit: "g", caloriesPer100g: 49, proteinPer100g: 4.3, carbsPer100g: 9, fatPer100g: 0.9 },
  { name: "Bell Pepper", aliases: ["bell pepper", "capsicum", "red pepper", "green pepper"], category: "vegetables", defaultUnit: "pieces", caloriesPer100g: 31, proteinPer100g: 1, carbsPer100g: 6, fatPer100g: 0.3 },
  { name: "Tomato", aliases: ["tomato", "tomatoes"], category: "vegetables", defaultUnit: "pieces", caloriesPer100g: 18, proteinPer100g: 0.9, carbsPer100g: 3.9, fatPer100g: 0.2 },
  { name: "Cucumber", aliases: ["cucumber"], category: "vegetables", defaultUnit: "pieces", caloriesPer100g: 16, proteinPer100g: 0.7, carbsPer100g: 3.6, fatPer100g: 0.1 },
  { name: "Zucchini", aliases: ["zucchini", "courgette"], category: "vegetables", defaultUnit: "g", caloriesPer100g: 17, proteinPer100g: 1.2, carbsPer100g: 3.1, fatPer100g: 0.3 },
  { name: "Asparagus", aliases: ["asparagus"], category: "vegetables", defaultUnit: "g", caloriesPer100g: 20, proteinPer100g: 2.2, carbsPer100g: 3.9, fatPer100g: 0.1 },
  { name: "Green Beans", aliases: ["green beans", "french beans"], category: "vegetables", defaultUnit: "g", caloriesPer100g: 31, proteinPer100g: 1.8, carbsPer100g: 7, fatPer100g: 0.2 },
  { name: "Cauliflower", aliases: ["cauliflower"], category: "vegetables", defaultUnit: "g", caloriesPer100g: 25, proteinPer100g: 1.9, carbsPer100g: 5, fatPer100g: 0.3 },
  { name: "Onion", aliases: ["onion", "onions", "red onion", "white onion"], category: "vegetables", defaultUnit: "pieces", caloriesPer100g: 40, proteinPer100g: 1.1, carbsPer100g: 9.3, fatPer100g: 0.1 },
  { name: "Garlic", aliases: ["garlic"], category: "pantry", defaultUnit: "cloves", caloriesPer100g: 149, proteinPer100g: 6.4, carbsPer100g: 33, fatPer100g: 0.5 },
  { name: "Mushrooms", aliases: ["mushroom", "mushrooms"], category: "vegetables", defaultUnit: "g", caloriesPer100g: 22, proteinPer100g: 3.1, carbsPer100g: 3.3, fatPer100g: 0.3 },
  { name: "Carrots", aliases: ["carrot", "carrots"], category: "vegetables", defaultUnit: "g", caloriesPer100g: 41, proteinPer100g: 0.9, carbsPer100g: 10, fatPer100g: 0.2 },
  { name: "Celery", aliases: ["celery"], category: "vegetables", defaultUnit: "g", caloriesPer100g: 16, proteinPer100g: 0.7, carbsPer100g: 3, fatPer100g: 0.2 },

  // ── Fruits ────────────────────────────────────────────────────────────────────
  { name: "Banana", aliases: ["banana", "bananas"], category: "fruits", defaultUnit: "pieces", caloriesPer100g: 89, proteinPer100g: 1.1, carbsPer100g: 23, fatPer100g: 0.3 },
  { name: "Apple", aliases: ["apple", "apples"], category: "fruits", defaultUnit: "pieces", caloriesPer100g: 52, proteinPer100g: 0.3, carbsPer100g: 14, fatPer100g: 0.2 },
  { name: "Blueberries", aliases: ["blueberry", "blueberries"], category: "fruits", defaultUnit: "g", caloriesPer100g: 57, proteinPer100g: 0.7, carbsPer100g: 14, fatPer100g: 0.3 },
  { name: "Strawberries", aliases: ["strawberry", "strawberries"], category: "fruits", defaultUnit: "g", caloriesPer100g: 32, proteinPer100g: 0.7, carbsPer100g: 7.7, fatPer100g: 0.3 },
  { name: "Orange", aliases: ["orange", "oranges"], category: "fruits", defaultUnit: "pieces", caloriesPer100g: 47, proteinPer100g: 0.9, carbsPer100g: 12, fatPer100g: 0.1 },
  { name: "Mango", aliases: ["mango", "mangos"], category: "fruits", defaultUnit: "g", caloriesPer100g: 60, proteinPer100g: 0.8, carbsPer100g: 15, fatPer100g: 0.4 },
  { name: "Pineapple", aliases: ["pineapple"], category: "fruits", defaultUnit: "g", caloriesPer100g: 50, proteinPer100g: 0.5, carbsPer100g: 13, fatPer100g: 0.1 },
  { name: "Raspberries", aliases: ["raspberry", "raspberries"], category: "fruits", defaultUnit: "g", caloriesPer100g: 52, proteinPer100g: 1.2, carbsPer100g: 12, fatPer100g: 0.7 },
  { name: "Grapes", aliases: ["grapes", "grape"], category: "fruits", defaultUnit: "g", caloriesPer100g: 69, proteinPer100g: 0.7, carbsPer100g: 18, fatPer100g: 0.2 },
  { name: "Avocado", aliases: ["avocado", "avocados"], category: "fats", defaultUnit: "pieces", caloriesPer100g: 160, proteinPer100g: 2, carbsPer100g: 9, fatPer100g: 15 },
  { name: "Watermelon", aliases: ["watermelon"], category: "fruits", defaultUnit: "g", caloriesPer100g: 30, proteinPer100g: 0.6, carbsPer100g: 8, fatPer100g: 0.2 },

  // ── Dairy ─────────────────────────────────────────────────────────────────────
  { name: "Whole Milk", aliases: ["milk", "whole milk", "full fat milk"], category: "dairy", defaultUnit: "ml", caloriesPer100g: 61, proteinPer100g: 3.2, carbsPer100g: 4.8, fatPer100g: 3.3 },
  { name: "Skimmed Milk", aliases: ["skimmed milk", "skim milk", "low fat milk"], category: "dairy", defaultUnit: "ml", caloriesPer100g: 34, proteinPer100g: 3.4, carbsPer100g: 5, fatPer100g: 0.1 },
  { name: "Greek Yogurt", aliases: ["greek yogurt", "greek yoghurt"], category: "dairy", defaultUnit: "g", caloriesPer100g: 59, proteinPer100g: 10, carbsPer100g: 3.6, fatPer100g: 0.4 },
  { name: "Plain Yogurt", aliases: ["plain yogurt", "yogurt", "yoghurt"], category: "dairy", defaultUnit: "g", caloriesPer100g: 61, proteinPer100g: 3.5, carbsPer100g: 4.7, fatPer100g: 3.3 },
  { name: "Cottage Cheese", aliases: ["cottage cheese"], category: "dairy", defaultUnit: "g", caloriesPer100g: 98, proteinPer100g: 11, carbsPer100g: 3.4, fatPer100g: 4.3 },
  { name: "Cheddar Cheese", aliases: ["cheddar", "cheddar cheese"], category: "dairy", defaultUnit: "g", caloriesPer100g: 403, proteinPer100g: 25, carbsPer100g: 1.3, fatPer100g: 33 },
  { name: "Mozzarella", aliases: ["mozzarella", "mozzarella cheese"], category: "dairy", defaultUnit: "g", caloriesPer100g: 280, proteinPer100g: 28, carbsPer100g: 2.2, fatPer100g: 17 },
  { name: "Butter", aliases: ["butter", "unsalted butter"], category: "dairy", defaultUnit: "g", caloriesPer100g: 717, proteinPer100g: 0.9, carbsPer100g: 0.1, fatPer100g: 81 },
  { name: "Almond Milk", aliases: ["almond milk"], category: "dairy", defaultUnit: "ml", caloriesPer100g: 15, proteinPer100g: 0.5, carbsPer100g: 0.6, fatPer100g: 1.1 },
  { name: "Oat Milk", aliases: ["oat milk"], category: "dairy", defaultUnit: "ml", caloriesPer100g: 46, proteinPer100g: 1, carbsPer100g: 9, fatPer100g: 1.5 },
  { name: "Whipping Cream", aliases: ["cream", "heavy cream", "whipping cream"], category: "dairy", defaultUnit: "ml", caloriesPer100g: 345, proteinPer100g: 2.1, carbsPer100g: 2.8, fatPer100g: 37 },

  // ── Healthy Fats ──────────────────────────────────────────────────────────────
  { name: "Olive Oil", aliases: ["olive oil", "extra virgin olive oil", "evoo"], category: "fats", defaultUnit: "ml", caloriesPer100g: 884, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 100 },
  { name: "Coconut Oil", aliases: ["coconut oil"], category: "fats", defaultUnit: "ml", caloriesPer100g: 862, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 100 },
  { name: "Almonds", aliases: ["almond", "almonds"], category: "fats", defaultUnit: "g", caloriesPer100g: 579, proteinPer100g: 21, carbsPer100g: 22, fatPer100g: 50 },
  { name: "Walnuts", aliases: ["walnut", "walnuts"], category: "fats", defaultUnit: "g", caloriesPer100g: 654, proteinPer100g: 15, carbsPer100g: 14, fatPer100g: 65 },
  { name: "Cashews", aliases: ["cashew", "cashews"], category: "fats", defaultUnit: "g", caloriesPer100g: 553, proteinPer100g: 18, carbsPer100g: 30, fatPer100g: 44 },
  { name: "Peanuts", aliases: ["peanut", "peanuts"], category: "fats", defaultUnit: "g", caloriesPer100g: 567, proteinPer100g: 26, carbsPer100g: 16, fatPer100g: 49 },
  { name: "Peanut Butter", aliases: ["peanut butter", "pb"], category: "fats", defaultUnit: "g", caloriesPer100g: 588, proteinPer100g: 25, carbsPer100g: 20, fatPer100g: 50 },
  { name: "Almond Butter", aliases: ["almond butter"], category: "fats", defaultUnit: "g", caloriesPer100g: 614, proteinPer100g: 21, carbsPer100g: 19, fatPer100g: 56 },
  { name: "Chia Seeds", aliases: ["chia seeds", "chia"], category: "fats", defaultUnit: "g", caloriesPer100g: 486, proteinPer100g: 17, carbsPer100g: 42, fatPer100g: 31 },
  { name: "Flaxseeds", aliases: ["flaxseeds", "flax seeds", "linseed"], category: "fats", defaultUnit: "g", caloriesPer100g: 534, proteinPer100g: 18, carbsPer100g: 29, fatPer100g: 42 },
  { name: "Mixed Nuts", aliases: ["mixed nuts", "trail mix"], category: "fats", defaultUnit: "g", caloriesPer100g: 607, proteinPer100g: 20, carbsPer100g: 21, fatPer100g: 54 },

  // ── Pantry / Condiments ────────────────────────────────────────────────────────
  { name: "Honey", aliases: ["honey"], category: "pantry", defaultUnit: "g", caloriesPer100g: 304, proteinPer100g: 0.3, carbsPer100g: 82, fatPer100g: 0 },
  { name: "Soy Sauce", aliases: ["soy sauce", "tamari"], category: "pantry", defaultUnit: "ml", caloriesPer100g: 53, proteinPer100g: 8, carbsPer100g: 5, fatPer100g: 0.1 },
  { name: "Tomato Sauce", aliases: ["tomato sauce", "marinara", "pasta sauce"], category: "pantry", defaultUnit: "g", caloriesPer100g: 29, proteinPer100g: 1.4, carbsPer100g: 5.5, fatPer100g: 0.5 },
  { name: "Diced Tomatoes", aliases: ["diced tomatoes", "canned tomatoes"], category: "pantry", defaultUnit: "cans", caloriesPer100g: 18, proteinPer100g: 0.9, carbsPer100g: 3.9, fatPer100g: 0.2 },
  { name: "Coconut Milk", aliases: ["coconut milk"], category: "pantry", defaultUnit: "ml", caloriesPer100g: 197, proteinPer100g: 2, carbsPer100g: 6, fatPer100g: 21 },
  { name: "Bone Broth", aliases: ["bone broth", "chicken broth", "stock"], category: "pantry", defaultUnit: "ml", caloriesPer100g: 10, proteinPer100g: 2, carbsPer100g: 0.5, fatPer100g: 0.2 },
  { name: "Apple Cider Vinegar", aliases: ["apple cider vinegar", "acv"], category: "pantry", defaultUnit: "ml", caloriesPer100g: 22, proteinPer100g: 0, carbsPer100g: 0.9, fatPer100g: 0 },
  { name: "Protein Powder", aliases: ["whey protein", "protein powder", "whey"], category: "supplements", defaultUnit: "g", caloriesPer100g: 400, proteinPer100g: 80, carbsPer100g: 8, fatPer100g: 4 },

  // ── Drinks ────────────────────────────────────────────────────────────────────
  { name: "Water", aliases: ["water"], category: "drinks", defaultUnit: "ml", caloriesPer100g: 0, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 0 },
  { name: "Orange Juice", aliases: ["orange juice", "oj"], category: "drinks", defaultUnit: "ml", caloriesPer100g: 45, proteinPer100g: 0.7, carbsPer100g: 10, fatPer100g: 0.2 },
  { name: "Green Tea", aliases: ["green tea"], category: "drinks", defaultUnit: "ml", caloriesPer100g: 1, proteinPer100g: 0.2, carbsPer100g: 0.2, fatPer100g: 0 },
  { name: "Black Coffee", aliases: ["coffee", "black coffee", "espresso"], category: "drinks", defaultUnit: "ml", caloriesPer100g: 2, proteinPer100g: 0.3, carbsPer100g: 0, fatPer100g: 0 },
  { name: "Protein Shake", aliases: ["protein shake", "protein drink"], category: "drinks", defaultUnit: "ml", caloriesPer100g: 60, proteinPer100g: 10, carbsPer100g: 4, fatPer100g: 1 },

  // ── Supplements ────────────────────────────────────────────────────────────────
  { name: "Creatine", aliases: ["creatine", "creatine monohydrate"], category: "supplements", defaultUnit: "g", caloriesPer100g: 0, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 0 },
  { name: "Vitamin D", aliases: ["vitamin d", "vitamin d3", "cholecalciferol"], category: "supplements", defaultUnit: "pieces", caloriesPer100g: 0, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 0 },
  { name: "Omega-3 Fish Oil", aliases: ["fish oil", "omega 3", "omega-3"], category: "supplements", defaultUnit: "pieces", caloriesPer100g: 902, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 100 },
  { name: "Magnesium", aliases: ["magnesium", "magnesium glycinate"], category: "supplements", defaultUnit: "pieces", caloriesPer100g: 0, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 0 },
  { name: "Multivitamin", aliases: ["multivitamin", "multi vitamin", "vitamins"], category: "supplements", defaultUnit: "pieces", caloriesPer100g: 0, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 0 },
  { name: "Zinc", aliases: ["zinc"], category: "supplements", defaultUnit: "pieces", caloriesPer100g: 0, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 0 },
  { name: "Collagen Peptides", aliases: ["collagen", "collagen peptides", "collagen powder"], category: "supplements", defaultUnit: "g", caloriesPer100g: 380, proteinPer100g: 90, carbsPer100g: 0, fatPer100g: 0 },
  { name: "BCAAs", aliases: ["bcaa", "bcaas", "amino acids"], category: "supplements", defaultUnit: "g", caloriesPer100g: 0, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 0 },
  { name: "Pre-Workout", aliases: ["pre workout", "pre-workout"], category: "supplements", defaultUnit: "g", caloriesPer100g: 0, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 0 },
];

/**
 * Search the built-in nutrition database by name query.
 * Returns entries matching the query prefix or containing it.
 */
export function searchNutritionDB(query: string, limit = 8): FoodEntry[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const scored: { entry: FoodEntry; score: number }[] = [];

  for (const entry of NUTRITION_DB) {
    const nameLower = entry.name.toLowerCase();
    const aliasMatch = entry.aliases?.some((a) => a.toLowerCase().includes(q));

    if (nameLower.startsWith(q)) {
      scored.push({ entry, score: 100 });
    } else if (nameLower.includes(q)) {
      scored.push({ entry, score: 80 });
    } else if (aliasMatch) {
      const alias = entry.aliases?.find((a) => a.toLowerCase().includes(q)) ?? "";
      scored.push({ entry, score: alias.toLowerCase().startsWith(q) ? 60 : 40 });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.entry);
}

/**
 * Find the best matching nutrition entry for a given food name (exact + fuzzy).
 */
export function suggestNutrition(name: string): FoodEntry | null {
  const q = name.toLowerCase().trim();
  if (!q) return null;

  // 1. Exact name match
  const exact = NUTRITION_DB.find((e) => e.name.toLowerCase() === q);
  if (exact) return exact;

  // 2. Alias exact match
  const aliasExact = NUTRITION_DB.find((e) =>
    e.aliases?.some((a) => a.toLowerCase() === q),
  );
  if (aliasExact) return aliasExact;

  // 3. Name starts with query
  const startsWith = NUTRITION_DB.find((e) => e.name.toLowerCase().startsWith(q));
  if (startsWith) return startsWith;

  // 4. Any contains match
  const contains = NUTRITION_DB.find(
    (e) =>
      e.name.toLowerCase().includes(q) ||
      e.aliases?.some((a) => a.toLowerCase().includes(q)),
  );
  return contains ?? null;
}
