import { Router, type IRouter } from "express";
import { eq, ilike, or } from "drizzle-orm";
import { db, foodsTable } from "@workspace/db";
import {
  SearchFoodsResponse,
  GetFoodResponse,
  CreateFoodBody,
  CreateFoodResponse,
  SuggestNutritionBody,
  SuggestNutritionResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { searchNutritionDB, suggestNutrition } from "../data/nutritionDatabase";

const router: IRouter = Router();

function serializeFood(f: typeof foodsTable.$inferSelect) {
  return {
    id: f.id,
    name: f.name,
    brand: f.brand ?? null,
    caloriesPer100g: Number(f.caloriesPer100g),
    proteinPer100g: Number(f.proteinPer100g),
    carbsPer100g: Number(f.carbsPer100g),
    fatPer100g: Number(f.fatPer100g),
    fiberPer100g: f.fiberPer100g !== null ? Number(f.fiberPer100g) : null,
    servingSize: f.servingSize !== null ? Number(f.servingSize) : null,
    servingUnit: f.servingUnit ?? null,
    isCustom: f.isCustom,
  };
}

// IMPORTANT: /foods/suggest-nutrition must be defined BEFORE /foods/:id
// to avoid Express treating "suggest-nutrition" as an id.
router.post("/foods/suggest-nutrition", requireAuth, async (req, res): Promise<void> => {
  const parsed = SuggestNutritionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const name = (parsed.data as { name: string }).name;
  const match = suggestNutrition(name);

  if (!match) {
    res.json(SuggestNutritionResponse.parse({
      found: false,
      category: null,
      defaultUnit: null,
      caloriesPer100g: null,
      proteinPer100g: null,
      carbsPer100g: null,
      fatPer100g: null,
    }));
    return;
  }

  res.json(SuggestNutritionResponse.parse({
    found: true,
    category: match.category,
    defaultUnit: match.defaultUnit,
    caloriesPer100g: match.caloriesPer100g,
    proteinPer100g: match.proteinPer100g,
    carbsPer100g: match.carbsPer100g,
    fatPer100g: match.fatPer100g,
  }));
});

router.get("/foods", requireAuth, async (req, res): Promise<void> => {
  const q = typeof req.query.q === "string" ? req.query.q : undefined;
  const rawLimit = req.query.limit;
  const limit = rawLimit ? Math.min(Number(rawLimit), 100) : 20;

  // Combine built-in nutrition DB results with user's custom foods
  if (q && q.trim()) {
    // 1. Search built-in nutrition DB (static, instant)
    const builtInMatches = searchNutritionDB(q, Math.ceil(limit / 2));
    const builtInFoods = builtInMatches.map((entry, idx) => ({
      id: -(idx + 1), // negative IDs to distinguish from DB entries
      name: entry.name,
      brand: null,
      caloriesPer100g: entry.caloriesPer100g,
      proteinPer100g: entry.proteinPer100g,
      carbsPer100g: entry.carbsPer100g,
      fatPer100g: entry.fatPer100g,
      fiberPer100g: null,
      servingSize: null,
      servingUnit: null,
      isCustom: false,
    }));

    // 2. Search user's custom foods in DB
    const dbFoods = await db
      .select()
      .from(foodsTable)
      .where(or(ilike(foodsTable.name, `%${q}%`), ilike(foodsTable.brand, `%${q}%`)))
      .limit(Math.floor(limit / 2));

    // Merge: DB foods first (custom), then built-in
    const combined = [
      ...dbFoods.map(serializeFood),
      ...builtInFoods.filter(
        (bf) => !dbFoods.some((df) => df.name.toLowerCase() === bf.name.toLowerCase()),
      ),
    ].slice(0, limit);

    res.json(SearchFoodsResponse.parse(combined));
    return;
  }

  // No query: return user's custom foods only
  const foods = await db.select().from(foodsTable).limit(limit);
  res.json(SearchFoodsResponse.parse(foods.map(serializeFood)));
});

router.get("/foods/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid food id" });
    return;
  }

  const [food] = await db.select().from(foodsTable).where(eq(foodsTable.id, id));
  if (!food) {
    res.status(404).json({ error: "Food not found" });
    return;
  }

  res.json(GetFoodResponse.parse(serializeFood(food)));
});

router.post("/foods", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateFoodBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data as Record<string, unknown>;

  const [food] = await db
    .insert(foodsTable)
    .values({
      name: data.name as string,
      brand: (data.brand as string) ?? null,
      caloriesPer100g: String(data.caloriesPer100g),
      proteinPer100g: String(data.proteinPer100g),
      carbsPer100g: String(data.carbsPer100g),
      fatPer100g: String(data.fatPer100g),
      fiberPer100g: data.fiberPer100g !== undefined ? String(data.fiberPer100g) : null,
      servingSize: data.servingSize !== undefined ? String(data.servingSize) : null,
      servingUnit: (data.servingUnit as string) ?? null,
      isCustom: true,
      userId: req.auth!.userId,
    })
    .returning();

  res.status(201).json(CreateFoodResponse.parse(serializeFood(food)));
});

export default router;
