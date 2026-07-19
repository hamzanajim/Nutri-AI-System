import { Router, type IRouter } from "express";
import { eq, ilike, or } from "drizzle-orm";
import { db, foodsTable } from "@workspace/db";
import {
  SearchFoodsResponse,
  GetFoodResponse,
  CreateFoodBody,
  CreateFoodResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

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

router.get("/foods", requireAuth, async (req, res): Promise<void> => {
  const q = typeof req.query.q === "string" ? req.query.q : undefined;
  const rawLimit = req.query.limit;
  const limit = rawLimit ? Math.min(Number(rawLimit), 100) : 20;

  let foods;
  if (q) {
    foods = await db
      .select()
      .from(foodsTable)
      .where(or(ilike(foodsTable.name, `%${q}%`), ilike(foodsTable.brand, `%${q}%`)))
      .limit(limit);
  } else {
    foods = await db.select().from(foodsTable).limit(limit);
  }

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
