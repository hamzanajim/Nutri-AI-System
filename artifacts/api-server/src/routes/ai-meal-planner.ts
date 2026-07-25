/**
 * AI Meal Planner — shared logic for generating and regenerating meal plans.
 */
import { eq, and, sql } from "drizzle-orm";
import {
  db,
  mealPlansTable,
  mealPlanMealsTable,
  mealPlanIngredientsTable,
  inventoryTable,
  profilesTable,
} from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AIMeal {
  name: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  scheduledTime: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  notes: string;
  prepInstructions: string;
  cookingTimeMinutes: number;
  ingredients: { name: string; inventoryItemId?: number; quantityG: number; unit: string }[];
}

// ── Ingredient name normalizer ────────────────────────────────────────────────

function normalizeIngName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(
      /\b(raw|fresh|cooked|frozen|dried|diced|sliced|chopped|minced|ground|boneless|skinless|whole|large|small|medium|organic|lean|light|low.fat)\b/g,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

function ingredientNamesMatch(inventoryName: string, ingredientName: string): boolean {
  const a = normalizeIngName(inventoryName);
  const b = normalizeIngName(ingredientName);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const singular = (s: string) =>
    s.replace(/ies$/, "y").replace(/ves$/, "f").replace(/es$/, "").replace(/s$/, "");
  const aBase = singular(a);
  const bBase = singular(b);
  if (aBase === bBase) return true;
  if (aBase.includes(bBase) || bBase.includes(aBase)) return true;
  return false;
}

// ── Context Builder ───────────────────────────────────────────────────────────

export async function buildUserContext(userId: number) {
  const [profile, inventory] = await Promise.all([
    db.select().from(profilesTable).where(eq(profilesTable.userId, userId)).then((r) => r[0]),
    db
      .select({
        id: inventoryTable.id,
        name: inventoryTable.name,
        category: inventoryTable.category,
        quantity: inventoryTable.quantity,
        unit: inventoryTable.unit,
        storageLocation: inventoryTable.storageLocation,
        caloriesPer100g: inventoryTable.caloriesPer100g,
        proteinPer100g: inventoryTable.proteinPer100g,
        carbsPer100g: inventoryTable.carbsPer100g,
        fatPer100g: inventoryTable.fatPer100g,
      })
      .from(inventoryTable)
      .where(eq(inventoryTable.userId, userId)),
  ]);

  let targets = { dailyCalories: 2000, proteinG: 150, carbsG: 200, fatG: 65 };
  if (profile?.weightKg && profile?.heightCm && profile?.age) {
    const w = Number(profile.weightKg);
    const h = Number(profile.heightCm);
    const age = Number(profile.age);
    const isFemale = profile.gender === "female";
    const bmr = isFemale
      ? 10 * w + 6.25 * h - 5 * age - 161
      : 10 * w + 6.25 * h - 5 * age + 5;
    const activityMap: Record<string, number> = {
      sedentary: 1.2,
      lightly_active: 1.375,
      moderately_active: 1.55,
      very_active: 1.725,
      extremely_active: 1.9,
    };
    const multiplier = activityMap[profile.activityLevel ?? "sedentary"] ?? 1.2;
    let tdee = bmr * multiplier;
    const goalAdj: Record<string, number> = {
      lose_fat: -500,
      maintain: 0,
      gain_muscle: 300,
      improve_health: -200,
    };
    tdee += goalAdj[profile.fitnessGoal ?? "maintain"] ?? 0;
    targets = {
      dailyCalories: Math.round(tdee),
      proteinG: Math.round((tdee * 0.3) / 4),
      carbsG: Math.round((tdee * 0.4) / 4),
      fatG: Math.round((tdee * 0.3) / 9),
    };
  }

  return { profile, inventory, targets };
}

// ── Match AI ingredient → inventory item ─────────────────────────────────────

function matchIngredientToInventory(
  ing: { name: string; inventoryItemId?: number; quantityG: number },
  inventory: Awaited<ReturnType<typeof buildUserContext>>["inventory"]
): (typeof inventory)[0] | undefined {
  // 1. AI provided explicit ID — highest priority
  if (ing.inventoryItemId) {
    const byId = inventory.find((i) => i.id === ing.inventoryItemId);
    if (byId) return byId;
  }
  // 2. Normalized exact match
  const exact = inventory.find(
    (i) => normalizeIngName(i.name) === normalizeIngName(ing.name)
  );
  if (exact) return exact;
  // 3. Fuzzy / partial / singular-plural
  return inventory.find((i) => ingredientNamesMatch(i.name, ing.name));
}

// ── Generate Full Meal Plan ───────────────────────────────────────────────────

export async function generateMealPlanWithAI(
  userId: number,
  date: string,
  mealCount: number,
  extraNotes: string = ""
): Promise<typeof mealPlansTable.$inferSelect & { meals: AIMeal[] }> {
  const { profile, inventory, targets } = await buildUserContext(userId);

  const availableIngredients = inventory
    .filter((i) => Number(i.quantity) > 0)
    .map(
      (i) =>
        `ID:${i.id} ${i.name} (${i.quantity}${i.unit}${i.category ? `, ${i.category}` : ""}${i.storageLocation ? `, ${i.storageLocation}` : ""}${i.caloriesPer100g ? `, ${i.caloriesPer100g}kcal/100g` : ""}${i.proteinPer100g ? `, ${i.proteinPer100g}g prot/100g` : ""})`
    );

  const mealTypes =
    mealCount === 2
      ? ["breakfast", "dinner"]
      : mealCount === 3
        ? ["breakfast", "lunch", "dinner"]
        : ["breakfast", "lunch", "dinner", "snack"];

  const systemPrompt = `You are a professional nutritionist and meal planner AI.
Return ONLY valid JSON with this exact shape:
{
  "meals": [
    {
      "name": "Chicken Rice Bowl",
      "mealType": "breakfast|lunch|dinner|snack",
      "scheduledTime": "08:00",
      "calories": 450,
      "proteinG": 35,
      "carbsG": 45,
      "fatG": 12,
      "notes": "High-protein balanced meal",
      "prepInstructions": "1. Season chicken with salt, pepper, garlic powder.\\n2. Grill 6 min per side on medium heat.\\n3. Cook rice per package. Steam broccoli 4 min.\\n4. Slice chicken and serve over rice with broccoli.",
      "cookingTimeMinutes": 20,
      "ingredients": [
        {"name": "Chicken Breast", "inventoryItemId": 42, "quantityG": 150, "unit": "g"},
        {"name": "Brown Rice", "inventoryItemId": 7, "quantityG": 80, "unit": "g"},
        {"name": "Broccoli", "inventoryItemId": 15, "quantityG": 100, "unit": "g"},
        {"name": "Olive Oil", "inventoryItemId": 3, "quantityG": 10, "unit": "g"}
      ]
    }
  ]
}

MANDATORY RULES — each violation makes the plan unusable:
1. MEAL NAMES: Appetising, specific names only. Good: "Chicken Rice Bowl", "Herb Salmon Plate", "Beef Burrito Bowl", "High Protein Breakfast Bowl", "Greek Yogurt Berry Bowl", "Tuna Avocado Salad", "Turkey Veggie Scramble", "Oat Banana Power Bowl". Bad: "Lunch", "Protein Meal", "Healthy Dish".
2. MEAL STRUCTURE: Every meal = ONE primary protein + ONE carbohydrate + ONE or more vegetables + optional healthy fat + seasoning.
3. ONE PROTEIN ONLY: Each meal has EXACTLY ONE primary protein. Never put two proteins in one meal (no chicken+salmon, no beef+tuna, no eggs+chicken).
4. PROTEIN VARIETY: Each meal across the day must use a DIFFERENT primary protein. Breakfast eggs → lunch must be chicken/fish/beef/etc. No repeated proteins.
5. INVENTORY IDs: When using an inventory item, include its exact numeric ID from the "ID:42" prefix as "inventoryItemId". Omit inventoryItemId for non-inventory items.
6. MACROS: Distribute daily targets proportionally across meals.
7. ALLERGIES/DIET: Respect every restriction — this is non-negotiable.`;

  const userPrompt = `Generate a ${mealCount}-meal plan for ${date}.

Profile:
- Goal: ${profile?.fitnessGoal ?? "maintain"}, Activity: ${profile?.activityLevel ?? "sedentary"}
- Diet: ${(profile?.dietPreferences ?? []).join(", ") || "none"}
- Allergies: ${(profile?.allergies ?? []).join(", ") || "none"}
- Intolerances: ${(profile?.foodIntolerances ?? []).join(", ") || "none"}
- Avoid: ${(profile?.foodsToAvoid ?? []).join(", ") || "none"}
- Favourites: ${(profile?.favoriteFoods ?? []).join(", ") || "none"}

Targets: ${targets.dailyCalories} kcal | P ${targets.proteinG}g | C ${targets.carbsG}g | F ${targets.fatG}g

Meal slots: ${mealTypes.join(", ")}

Inventory (use ID as inventoryItemId):
${availableIngredients.length > 0 ? availableIngredients.join("\n") : "No inventory — use common pantry staples"}
${extraNotes ? `\nExtra notes: ${extraNotes}` : ""}`;

  const response = await openai.chat.completions.create({
    model: "gpt-5.6-luna",
    max_completion_tokens: 4096,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content) as { meals?: AIMeal[] };
  const meals = parsed.meals ?? [];

  const [plan] = await db
    .insert(mealPlansTable)
    .values({ userId, date, name: `Meal Plan — ${date}`, status: "active" })
    .returning();

  for (const aiMeal of meals) {
    const [mealRow] = await db
      .insert(mealPlanMealsTable)
      .values({
        planId: plan.id,
        name: aiMeal.name,
        mealType: aiMeal.mealType,
        scheduledTime: aiMeal.scheduledTime,
        calories: String(aiMeal.calories ?? 0),
        proteinG: String(aiMeal.proteinG ?? 0),
        carbsG: String(aiMeal.carbsG ?? 0),
        fatG: String(aiMeal.fatG ?? 0),
        notes: aiMeal.notes,
        prepInstructions: aiMeal.prepInstructions,
        cookingTimeMinutes: aiMeal.cookingTimeMinutes,
      })
      .returning();

    for (const ing of aiMeal.ingredients ?? []) {
      const matchedItem = matchIngredientToInventory(ing, inventory);
      const sufficient = !!matchedItem && Number(matchedItem.quantity) >= ing.quantityG;
      await db.insert(mealPlanIngredientsTable).values({
        mealId: mealRow.id,
        name: ing.name,
        quantityG: String(ing.quantityG),
        unit: ing.unit ?? "g",
        available: sufficient,
        inventoryItemId: matchedItem?.id ?? null,
      });
    }
  }

  return { ...plan, meals };
}

// ── Regenerate Single Meal ────────────────────────────────────────────────────

export async function regenerateSingleMeal({
  plan,
  meal,
  userId,
}: {
  plan: typeof mealPlansTable.$inferSelect;
  meal: typeof mealPlanMealsTable.$inferSelect;
  userId: number;
}) {
  const { profile, inventory, targets } = await buildUserContext(userId);

  // Gather sibling meals to avoid protein repetition
  const otherMeals = await db
    .select({ name: mealPlanMealsTable.name })
    .from(mealPlanMealsTable)
    .where(
      and(
        eq(mealPlanMealsTable.planId, plan.id),
        sql`${mealPlanMealsTable.id} != ${meal.id}`
      )
    );

  const availableIngredients = inventory
    .filter((i) => Number(i.quantity) > 0)
    .map((i) => `ID:${i.id} ${i.name} (${i.quantity}${i.unit}${i.category ? `, ${i.category}` : ""})`);

  const otherCtx =
    otherMeals.length > 0
      ? `\nExisting meals today (use a DIFFERENT primary protein): ${otherMeals.map((m) => `"${m.name}"`).join(", ")}`
      : "";

  const response = await openai.chat.completions.create({
    model: "gpt-5.6-luna",
    max_completion_tokens: 1500,
    messages: [
      {
        role: "system",
        content: `You are a meal planning AI. Return ONLY valid JSON for one meal:
{"name":"...","mealType":"breakfast|lunch|dinner|snack","scheduledTime":"HH:MM","calories":0,"proteinG":0,"carbsG":0,"fatG":0,"notes":"...","prepInstructions":"1. Step.\\n2. Step.","cookingTimeMinutes":0,"ingredients":[{"name":"...","inventoryItemId":42,"quantityG":0,"unit":"g"}]}
Rules: (1) Appetising name e.g. "Herb Salmon Plate". (2) EXACTLY ONE primary protein. (3) Protein+Carb+Veg+optional Fat+Seasoning. (4) Include inventoryItemId for inventory items.`,
      },
      {
        role: "user",
        content: `Regenerate a ${meal.mealType} for ${plan.date}.
Allergies: ${(profile?.allergies ?? []).join(", ") || "none"}
Diet prefs: ${(profile?.dietPreferences ?? []).join(", ") || "none"}
Avoid: ${(profile?.foodsToAvoid ?? []).join(", ") || "none"}
Target: ~${Math.round(targets.dailyCalories / 3)} kcal
Inventory: ${availableIngredients.slice(0, 30).join(", ") || "common items"}
Do NOT repeat: "${meal.name}"${otherCtx}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  const aiMeal = JSON.parse(content) as AIMeal;

  await db.delete(mealPlanIngredientsTable).where(eq(mealPlanIngredientsTable.mealId, meal.id));

  const [updatedMeal] = await db
    .update(mealPlanMealsTable)
    .set({
      name: aiMeal.name,
      mealType: aiMeal.mealType,
      scheduledTime: aiMeal.scheduledTime,
      calories: String(aiMeal.calories ?? 0),
      proteinG: String(aiMeal.proteinG ?? 0),
      carbsG: String(aiMeal.carbsG ?? 0),
      fatG: String(aiMeal.fatG ?? 0),
      notes: aiMeal.notes,
      prepInstructions: aiMeal.prepInstructions,
      cookingTimeMinutes: aiMeal.cookingTimeMinutes,
      completed: false,
      completedAt: null,
    })
    .where(eq(mealPlanMealsTable.id, meal.id))
    .returning();

  const newIngredients = [];
  for (const ing of aiMeal.ingredients ?? []) {
    const matchedItem = matchIngredientToInventory(ing, inventory);
    const sufficient = !!matchedItem && Number(matchedItem.quantity) >= ing.quantityG;
    const [ingRow] = await db
      .insert(mealPlanIngredientsTable)
      .values({
        mealId: meal.id,
        name: ing.name,
        quantityG: String(ing.quantityG),
        unit: ing.unit ?? "g",
        available: sufficient,
        inventoryItemId: matchedItem?.id ?? null,
      })
      .returning();
    newIngredients.push(ingRow);
  }

  return {
    id: updatedMeal.id,
    planId: updatedMeal.planId,
    name: updatedMeal.name,
    mealType: updatedMeal.mealType,
    scheduledTime: updatedMeal.scheduledTime ?? null,
    calories: updatedMeal.calories !== null ? Number(updatedMeal.calories) : null,
    proteinG: updatedMeal.proteinG !== null ? Number(updatedMeal.proteinG) : null,
    carbsG: updatedMeal.carbsG !== null ? Number(updatedMeal.carbsG) : null,
    fatG: updatedMeal.fatG !== null ? Number(updatedMeal.fatG) : null,
    notes: updatedMeal.notes ?? null,
    prepInstructions: updatedMeal.prepInstructions ?? null,
    cookingTimeMinutes: updatedMeal.cookingTimeMinutes ?? null,
    completed: false,
    completedAt: null,
    ingredients: newIngredients.map((ing) => ({
      id: ing.id,
      mealId: ing.mealId,
      name: ing.name,
      quantityG: Number(ing.quantityG),
      unit: ing.unit,
      available: ing.available,
      inventoryItemId: ing.inventoryItemId ?? null,
      substituteFor: ing.substituteFor ?? null,
      substituteReason: ing.substituteReason ?? null,
    })),
  };
}
