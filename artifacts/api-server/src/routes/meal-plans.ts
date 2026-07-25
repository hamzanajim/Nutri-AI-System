import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import {
  db,
  mealPlansTable,
  mealPlanMealsTable,
  mealPlanIngredientsTable,
  inventoryTable,
  mealsTable,
  mealItemsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

function serializeIngredient(ing: typeof mealPlanIngredientsTable.$inferSelect) {
  return {
    id: ing.id,
    mealId: ing.mealId,
    name: ing.name,
    quantityG: Number(ing.quantityG),
    unit: ing.unit,
    available: ing.available,
    inventoryItemId: ing.inventoryItemId ?? null,
    substituteFor: ing.substituteFor ?? null,
    substituteReason: ing.substituteReason ?? null,
  };
}

function serializeMeal(
  meal: typeof mealPlanMealsTable.$inferSelect,
  ingredients: (typeof mealPlanIngredientsTable.$inferSelect)[]
) {
  return {
    id: meal.id,
    planId: meal.planId,
    name: meal.name,
    mealType: meal.mealType,
    scheduledTime: meal.scheduledTime ?? null,
    calories: meal.calories !== null ? Number(meal.calories) : null,
    proteinG: meal.proteinG !== null ? Number(meal.proteinG) : null,
    carbsG: meal.carbsG !== null ? Number(meal.carbsG) : null,
    fatG: meal.fatG !== null ? Number(meal.fatG) : null,
    notes: meal.notes ?? null,
    prepInstructions: meal.prepInstructions ?? null,
    cookingTimeMinutes: meal.cookingTimeMinutes ?? null,
    completed: meal.completed,
    completedAt: meal.completedAt?.toISOString() ?? null,
    ingredients: ingredients.map(serializeIngredient),
  };
}

async function buildPlanDetail(planId: number, userId: number) {
  const [plan] = await db
    .select()
    .from(mealPlansTable)
    .where(and(eq(mealPlansTable.id, planId), eq(mealPlansTable.userId, userId)));
  if (!plan) return null;

  const meals = await db
    .select()
    .from(mealPlanMealsTable)
    .where(eq(mealPlanMealsTable.planId, planId))
    .orderBy(mealPlanMealsTable.id);

  const mealIds = meals.map((m) => m.id);
  const allIngredients =
    mealIds.length > 0
      ? await db
          .select()
          .from(mealPlanIngredientsTable)
          .where(sql`${mealPlanIngredientsTable.mealId} = ANY(${sql.raw(`ARRAY[${mealIds.join(",")}]`)})`)
      : [];

  const ingredientsByMeal = new Map<number, (typeof mealPlanIngredientsTable.$inferSelect)[]>();
  for (const ing of allIngredients) {
    const list = ingredientsByMeal.get(ing.mealId) ?? [];
    list.push(ing);
    ingredientsByMeal.set(ing.mealId, list);
  }

  const serializedMeals = meals.map((m) => serializeMeal(m, ingredientsByMeal.get(m.id) ?? []));

  const totalCalories = serializedMeals.reduce((s, m) => s + (m.calories ?? 0), 0);
  const totalProteinG = serializedMeals.reduce((s, m) => s + (m.proteinG ?? 0), 0);
  const totalCarbsG = serializedMeals.reduce((s, m) => s + (m.carbsG ?? 0), 0);
  const totalFatG = serializedMeals.reduce((s, m) => s + (m.fatG ?? 0), 0);

  return {
    id: plan.id,
    userId: plan.userId,
    date: plan.date,
    name: plan.name,
    status: plan.status,
    meals: serializedMeals,
    totalCalories,
    totalProteinG,
    totalCarbsG,
    totalFatG,
    createdAt: plan.createdAt.toISOString(),
  };
}

// ── Routes ───────────────────────────────────────────────────────────────────

router.get("/meal-plans", requireAuth, async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  const date = req.query.date as string | undefined;

  const plans = await db
    .select()
    .from(mealPlansTable)
    .where(
      date
        ? and(eq(mealPlansTable.userId, userId), eq(mealPlansTable.date, date))
        : eq(mealPlansTable.userId, userId)
    )
    .orderBy(mealPlansTable.date);

  // For listing we just include summary counts, not full meals
  const result = await Promise.all(
    plans.map(async (plan) => {
      const meals = await db
        .select()
        .from(mealPlanMealsTable)
        .where(eq(mealPlanMealsTable.planId, plan.id));

      const totalCalories = meals.reduce((s, m) => s + (m.calories !== null ? Number(m.calories) : 0), 0);
      const totalProteinG = meals.reduce((s, m) => s + (m.proteinG !== null ? Number(m.proteinG) : 0), 0);
      const totalCarbsG = meals.reduce((s, m) => s + (m.carbsG !== null ? Number(m.carbsG) : 0), 0);
      const totalFatG = meals.reduce((s, m) => s + (m.fatG !== null ? Number(m.fatG) : 0), 0);

      return {
        id: plan.id,
        userId: plan.userId,
        date: plan.date,
        name: plan.name,
        status: plan.status,
        totalCalories,
        totalProteinG,
        totalCarbsG,
        totalFatG,
        mealCount: meals.length,
        createdAt: plan.createdAt.toISOString(),
      };
    })
  );

  res.json(result);
});

router.post("/meal-plans", requireAuth, async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  const { date, name } = req.body as { date: string; name?: string };

  if (!date) {
    res.status(400).json({ error: "date is required" });
    return;
  }

  const [plan] = await db
    .insert(mealPlansTable)
    .values({ userId, date, name: name ?? "Daily Plan" })
    .returning();

  const detail = await buildPlanDetail(plan.id, userId);
  res.status(201).json(detail);
});

router.get("/meal-plans/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const detail = await buildPlanDetail(id, req.auth!.userId);
  if (!detail) { res.status(404).json({ error: "Meal plan not found" }); return; }

  res.json(detail);
});

router.delete("/meal-plans/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [deleted] = await db
    .delete(mealPlansTable)
    .where(and(eq(mealPlansTable.id, id), eq(mealPlansTable.userId, req.auth!.userId)))
    .returning({ id: mealPlansTable.id });

  if (!deleted) { res.status(404).json({ error: "Meal plan not found" }); return; }

  res.status(204).end();
});

router.patch("/meal-plans/:id/meals/:mealId", requireAuth, async (req, res): Promise<void> => {
  const planId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const mealId = parseInt(Array.isArray(req.params.mealId) ? req.params.mealId[0] : req.params.mealId, 10);
  if (isNaN(planId) || isNaN(mealId)) { res.status(400).json({ error: "Invalid id" }); return; }

  // Verify plan ownership
  const [plan] = await db
    .select()
    .from(mealPlansTable)
    .where(and(eq(mealPlansTable.id, planId), eq(mealPlansTable.userId, req.auth!.userId)));
  if (!plan) { res.status(404).json({ error: "Meal plan not found" }); return; }

  const { name, mealType, scheduledTime, notes } = req.body as Record<string, string>;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (mealType !== undefined) updates.mealType = mealType;
  if (scheduledTime !== undefined) updates.scheduledTime = scheduledTime;
  if (notes !== undefined) updates.notes = notes;

  const [updated] = await db
    .update(mealPlanMealsTable)
    .set(updates)
    .where(and(eq(mealPlanMealsTable.id, mealId), eq(mealPlanMealsTable.planId, planId)))
    .returning();

  if (!updated) { res.status(404).json({ error: "Meal not found" }); return; }

  const ingredients = await db
    .select()
    .from(mealPlanIngredientsTable)
    .where(eq(mealPlanIngredientsTable.mealId, mealId));

  res.json(serializeMeal(updated, ingredients));
});

router.delete("/meal-plans/:id/meals/:mealId", requireAuth, async (req, res): Promise<void> => {
  const planId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const mealId = parseInt(Array.isArray(req.params.mealId) ? req.params.mealId[0] : req.params.mealId, 10);
  if (isNaN(planId) || isNaN(mealId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [plan] = await db
    .select({ id: mealPlansTable.id })
    .from(mealPlansTable)
    .where(and(eq(mealPlansTable.id, planId), eq(mealPlansTable.userId, req.auth!.userId)));
  if (!plan) { res.status(404).json({ error: "Meal plan not found" }); return; }

  const [deleted] = await db
    .delete(mealPlanMealsTable)
    .where(and(eq(mealPlanMealsTable.id, mealId), eq(mealPlanMealsTable.planId, planId)))
    .returning({ id: mealPlanMealsTable.id });

  if (!deleted) { res.status(404).json({ error: "Meal not found" }); return; }

  res.status(204).end();
});

router.post("/meal-plans/:id/meals/:mealId/complete", requireAuth, async (req, res): Promise<void> => {
  const planId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const mealId = parseInt(Array.isArray(req.params.mealId) ? req.params.mealId[0] : req.params.mealId, 10);
  if (isNaN(planId) || isNaN(mealId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const userId = req.auth!.userId;

  const [plan] = await db
    .select()
    .from(mealPlansTable)
    .where(and(eq(mealPlansTable.id, planId), eq(mealPlansTable.userId, userId)));
  if (!plan) { res.status(404).json({ error: "Meal plan not found" }); return; }

  const [meal] = await db
    .select()
    .from(mealPlanMealsTable)
    .where(and(eq(mealPlanMealsTable.id, mealId), eq(mealPlanMealsTable.planId, planId)));
  if (!meal) { res.status(404).json({ error: "Meal not found" }); return; }

  if (meal.completed) {
    const ingredients = await db
      .select()
      .from(mealPlanIngredientsTable)
      .where(eq(mealPlanIngredientsTable.mealId, mealId));
    res.json(serializeMeal(meal, ingredients));
    return;
  }

  // Get all ingredients for this meal
  const ingredients = await db
    .select()
    .from(mealPlanIngredientsTable)
    .where(eq(mealPlanIngredientsTable.mealId, mealId));

  // Deduct ingredients from inventory
  for (const ing of ingredients) {
    // Try by inventoryItemId first, then by name match
    let invItem: typeof inventoryTable.$inferSelect | undefined;

    if (ing.inventoryItemId) {
      [invItem] = await db
        .select()
        .from(inventoryTable)
        .where(and(eq(inventoryTable.id, ing.inventoryItemId), eq(inventoryTable.userId, userId)));
    }

    if (!invItem) {
      const items = await db
        .select()
        .from(inventoryTable)
        .where(
          and(
            eq(inventoryTable.userId, userId),
            sql`lower(${inventoryTable.name}) = lower(${ing.name})`
          )
        );
      invItem = items[0];
    }

    if (invItem) {
      const currentQty = Number(invItem.quantity);
      const deduct = Number(ing.quantityG);
      const newQty = Math.max(0, currentQty - deduct);
      await db
        .update(inventoryTable)
        .set({ quantity: String(newQty) })
        .where(eq(inventoryTable.id, invItem.id));
    }
  }

  // Mark meal as completed
  const [updatedMeal] = await db
    .update(mealPlanMealsTable)
    .set({ completed: true, completedAt: new Date() })
    .where(eq(mealPlanMealsTable.id, mealId))
    .returning();

  // Create a nutrition log entry in the meals table
  try {
    const [mealLog] = await db
      .insert(mealsTable)
      .values({
        userId,
        name: meal.name,
        mealType: meal.mealType as "breakfast" | "lunch" | "dinner" | "snack",
        date: plan.date,
        notes: "Logged from meal plan",
      })
      .returning();

    // Add a single aggregate item to represent the meal's nutrition
    if (meal.calories !== null && Number(meal.calories) > 0) {
      await db.insert(mealItemsTable).values({
        mealId: mealLog.id,
        foodName: meal.name,
        quantityG: "100",
        calories: String(Number(meal.calories)),
        proteinG: String(Number(meal.proteinG ?? 0)),
        carbsG: String(Number(meal.carbsG ?? 0)),
        fatG: String(Number(meal.fatG ?? 0)),
        fiberG: "0",
      });
    }
  } catch {
    // Non-fatal: meal log creation is best-effort
  }

  res.json(serializeMeal(updatedMeal, ingredients));
});

// Regenerate is handled by the AI route — forward to it
// The endpoint is declared but the actual AI logic lives in ai.ts
// ── PATCH a single ingredient ──────────────────────────────────────────────
router.patch("/meal-plans/:id/meals/:mealId/ingredients/:ingId", requireAuth, async (req, res): Promise<void> => {
  const planId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const mealId = parseInt(Array.isArray(req.params.mealId) ? req.params.mealId[0] : req.params.mealId, 10);
  const ingId  = parseInt(Array.isArray(req.params.ingId)  ? req.params.ingId[0]  : req.params.ingId,  10);
  if (isNaN(planId) || isNaN(mealId) || isNaN(ingId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [plan] = await db
    .select({ id: mealPlansTable.id })
    .from(mealPlansTable)
    .where(and(eq(mealPlansTable.id, planId), eq(mealPlansTable.userId, req.auth!.userId)));
  if (!plan) { res.status(404).json({ error: "Meal plan not found" }); return; }

  const { name, inventoryItemId, available } = req.body as {
    name?: string;
    inventoryItemId?: number | null;
    available?: boolean;
  };
  const updates: Record<string, unknown> = {};
  if (name !== undefined)             updates.name            = name;
  if (inventoryItemId !== undefined)  updates.inventoryItemId = inventoryItemId;
  if (available !== undefined)        updates.available       = available;

  const [updated] = await db
    .update(mealPlanIngredientsTable)
    .set(updates)
    .where(and(eq(mealPlanIngredientsTable.id, ingId), eq(mealPlanIngredientsTable.mealId, mealId)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Ingredient not found" }); return; }

  res.json(serializeIngredient(updated));
});

router.post("/meal-plans/:id/meals/:mealId/regenerate", requireAuth, async (req, res): Promise<void> => {
  const planId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const mealId = parseInt(Array.isArray(req.params.mealId) ? req.params.mealId[0] : req.params.mealId, 10);
  if (isNaN(planId) || isNaN(mealId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const userId = req.auth!.userId;

  const [plan] = await db
    .select()
    .from(mealPlansTable)
    .where(and(eq(mealPlansTable.id, planId), eq(mealPlansTable.userId, userId)));
  if (!plan) { res.status(404).json({ error: "Meal plan not found" }); return; }

  const [meal] = await db
    .select()
    .from(mealPlanMealsTable)
    .where(and(eq(mealPlanMealsTable.id, mealId), eq(mealPlanMealsTable.planId, planId)));
  if (!meal) { res.status(404).json({ error: "Meal not found" }); return; }

  // Import AI logic dynamically to avoid circular dep
  const { regenerateSingleMeal } = await import("./ai-meal-planner.js");
  const result = await regenerateSingleMeal({ plan, meal, userId });

  res.json(result);
});

export default router;
