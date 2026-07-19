import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, mealsTable, mealItemsTable } from "@workspace/db";
import {
  ListMealsResponse,
  GetMealResponse,
  CreateMealBody,
  CreateMealResponse,
  UpdateMealBody,
  UpdateMealResponse,
  AddMealItemBody,
  AddMealItemResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function serializeMealItem(item: typeof mealItemsTable.$inferSelect) {
  return {
    id: item.id,
    mealId: item.mealId,
    foodId: item.foodId ?? null,
    foodName: item.foodName,
    quantityG: Number(item.quantityG),
    calories: Number(item.calories),
    proteinG: Number(item.proteinG),
    carbsG: Number(item.carbsG),
    fatG: Number(item.fatG),
    fiberG: item.fiberG !== null ? Number(item.fiberG) : null,
  };
}

function buildMealWithItems(
  meal: typeof mealsTable.$inferSelect,
  items: (typeof mealItemsTable.$inferSelect)[],
) {
  const serializedItems = items.map(serializeMealItem);
  return {
    id: meal.id,
    userId: meal.userId,
    name: meal.name,
    mealType: meal.mealType,
    date: meal.date,
    notes: meal.notes ?? null,
    items: serializedItems,
    totalCalories: serializedItems.reduce((s, i) => s + i.calories, 0),
    totalProteinG: serializedItems.reduce((s, i) => s + i.proteinG, 0),
    totalCarbsG: serializedItems.reduce((s, i) => s + i.carbsG, 0),
    totalFatG: serializedItems.reduce((s, i) => s + i.fatG, 0),
    createdAt: meal.createdAt,
  };
}

router.get("/meals", requireAuth, async (req, res): Promise<void> => {
  const dateFilter = typeof req.query.date === "string" ? req.query.date : undefined;

  const conditions = [eq(mealsTable.userId, req.auth!.userId)];
  if (dateFilter) {
    conditions.push(eq(mealsTable.date, dateFilter));
  }

  const meals = await db
    .select()
    .from(mealsTable)
    .where(and(...conditions))
    .orderBy(mealsTable.date, mealsTable.createdAt);

  const mealIds = meals.map((m) => m.id);
  const allItems =
    mealIds.length > 0
      ? await db
          .select()
          .from(mealItemsTable)
          .where(
            mealIds.length === 1
              ? eq(mealItemsTable.mealId, mealIds[0])
              : (() => {
                  // Use inArray equivalent via OR
                  const { or, eq: eqOp } = require("drizzle-orm");
                  return or(...mealIds.map((id) => eqOp(mealItemsTable.mealId, id)));
                })(),
          )
      : [];

  const itemsByMeal = new Map<number, (typeof mealItemsTable.$inferSelect)[]>();
  for (const item of allItems) {
    const existing = itemsByMeal.get(item.mealId) ?? [];
    existing.push(item);
    itemsByMeal.set(item.mealId, existing);
  }

  const result = meals.map((m) => buildMealWithItems(m, itemsByMeal.get(m.id) ?? []));
  res.json(ListMealsResponse.parse(result));
});

router.post("/meals", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateMealBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data as Record<string, unknown>;

  const [meal] = await db
    .insert(mealsTable)
    .values({
      userId: req.auth!.userId,
      name: data.name as string,
      mealType: data.mealType as string,
      date: data.date as string,
      notes: (data.notes as string) ?? null,
    })
    .returning();

  res.status(201).json(CreateMealResponse.parse(buildMealWithItems(meal, [])));
});

router.get("/meals/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid meal id" });
    return;
  }

  const [meal] = await db
    .select()
    .from(mealsTable)
    .where(and(eq(mealsTable.id, id), eq(mealsTable.userId, req.auth!.userId)));

  if (!meal) {
    res.status(404).json({ error: "Meal not found" });
    return;
  }

  const items = await db
    .select()
    .from(mealItemsTable)
    .where(eq(mealItemsTable.mealId, id));

  res.json(GetMealResponse.parse(buildMealWithItems(meal, items)));
});

router.patch("/meals/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid meal id" });
    return;
  }

  const parsed = UpdateMealBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.mealType !== undefined) updates.mealType = data.mealType;
  if (data.date !== undefined) updates.date = data.date;
  if (data.notes !== undefined) updates.notes = data.notes;

  const [meal] = await db
    .update(mealsTable)
    .set(updates)
    .where(and(eq(mealsTable.id, id), eq(mealsTable.userId, req.auth!.userId)))
    .returning();

  if (!meal) {
    res.status(404).json({ error: "Meal not found" });
    return;
  }

  const items = await db
    .select()
    .from(mealItemsTable)
    .where(eq(mealItemsTable.mealId, id));

  res.json(UpdateMealResponse.parse(buildMealWithItems(meal, items)));
});

router.delete("/meals/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid meal id" });
    return;
  }

  const [meal] = await db
    .delete(mealsTable)
    .where(and(eq(mealsTable.id, id), eq(mealsTable.userId, req.auth!.userId)))
    .returning({ id: mealsTable.id });

  if (!meal) {
    res.status(404).json({ error: "Meal not found" });
    return;
  }

  res.sendStatus(204);
});

router.post("/meals/:mealId/items", requireAuth, async (req, res): Promise<void> => {
  const rawMealId = Array.isArray(req.params.mealId)
    ? req.params.mealId[0]
    : req.params.mealId;
  const mealId = parseInt(rawMealId, 10);
  if (isNaN(mealId)) {
    res.status(400).json({ error: "Invalid meal id" });
    return;
  }

  const [meal] = await db
    .select({ id: mealsTable.id })
    .from(mealsTable)
    .where(and(eq(mealsTable.id, mealId), eq(mealsTable.userId, req.auth!.userId)));

  if (!meal) {
    res.status(404).json({ error: "Meal not found" });
    return;
  }

  const parsed = AddMealItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data as Record<string, unknown>;
  const quantityG = Number(data.quantityG);
  const cal100 = Number(data.caloriesPer100g);
  const pro100 = Number(data.proteinPer100g);
  const carb100 = Number(data.carbsPer100g);
  const fat100 = Number(data.fatPer100g);
  const fib100 = data.fiberPer100g !== undefined ? Number(data.fiberPer100g) : null;

  const factor = quantityG / 100;

  const [item] = await db
    .insert(mealItemsTable)
    .values({
      mealId,
      foodId: (data.foodId as number) ?? null,
      foodName: data.foodName as string,
      quantityG: String(quantityG),
      calories: String(Math.round(cal100 * factor * 10) / 10),
      proteinG: String(Math.round(pro100 * factor * 10) / 10),
      carbsG: String(Math.round(carb100 * factor * 10) / 10),
      fatG: String(Math.round(fat100 * factor * 10) / 10),
      fiberG: fib100 !== null ? String(Math.round(fib100 * factor * 10) / 10) : null,
    })
    .returning();

  res.status(201).json(AddMealItemResponse.parse(serializeMealItem(item)));
});

router.delete(
  "/meals/:mealId/items/:itemId",
  requireAuth,
  async (req, res): Promise<void> => {
    const rawMealId = Array.isArray(req.params.mealId)
      ? req.params.mealId[0]
      : req.params.mealId;
    const rawItemId = Array.isArray(req.params.itemId)
      ? req.params.itemId[0]
      : req.params.itemId;
    const mealId = parseInt(rawMealId, 10);
    const itemId = parseInt(rawItemId, 10);

    if (isNaN(mealId) || isNaN(itemId)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    // Verify meal belongs to user
    const [meal] = await db
      .select({ id: mealsTable.id })
      .from(mealsTable)
      .where(and(eq(mealsTable.id, mealId), eq(mealsTable.userId, req.auth!.userId)));

    if (!meal) {
      res.status(404).json({ error: "Meal not found" });
      return;
    }

    const [item] = await db
      .delete(mealItemsTable)
      .where(and(eq(mealItemsTable.id, itemId), eq(mealItemsTable.mealId, mealId)))
      .returning({ id: mealItemsTable.id });

    if (!item) {
      res.status(404).json({ error: "Meal item not found" });
      return;
    }

    res.sendStatus(204);
  },
);

export default router;
