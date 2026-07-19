import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, mealsTable, mealItemsTable, profilesTable } from "@workspace/db";
import {
  GetDailyNutritionResponse,
  GetNutritionTargetsResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extremely_active: 1.9,
};

const GOAL_CALORIE_ADJUSTMENTS: Record<string, number> = {
  lose_weight: -500,
  maintain: 0,
  gain_muscle: 300,
  improve_endurance: 100,
  improve_health: 0,
};

router.get("/nutrition/daily", requireAuth, async (req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const date = typeof req.query.date === "string" ? req.query.date : today;

  const meals = await db
    .select()
    .from(mealsTable)
    .where(and(eq(mealsTable.userId, req.auth!.userId), eq(mealsTable.date, date)))
    .orderBy(mealsTable.createdAt);

  const allItems =
    meals.length > 0
      ? await db
          .select()
          .from(mealItemsTable)
          .where(
            meals.length === 1
              ? eq(mealItemsTable.mealId, meals[0].id)
              : (() => {
                  const { or, eq: eqOp } = require("drizzle-orm");
                  return or(...meals.map((m) => eqOp(mealItemsTable.mealId, m.id)));
                })(),
          )
      : [];

  const itemsByMeal = new Map<number, (typeof mealItemsTable.$inferSelect)[]>();
  for (const item of allItems) {
    const existing = itemsByMeal.get(item.mealId) ?? [];
    existing.push(item);
    itemsByMeal.set(item.mealId, existing);
  }

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

  const mealsWithItems = meals.map((m) => {
    const items = (itemsByMeal.get(m.id) ?? []).map(serializeMealItem);
    return {
      id: m.id,
      userId: m.userId,
      name: m.name,
      mealType: m.mealType,
      date: m.date,
      notes: m.notes ?? null,
      items,
      totalCalories: items.reduce((s, i) => s + i.calories, 0),
      totalProteinG: items.reduce((s, i) => s + i.proteinG, 0),
      totalCarbsG: items.reduce((s, i) => s + i.carbsG, 0),
      totalFatG: items.reduce((s, i) => s + i.fatG, 0),
      createdAt: m.createdAt,
    };
  });

  const totals = mealsWithItems.reduce(
    (acc, m) => {
      acc.calories += m.totalCalories;
      acc.protein += m.totalProteinG;
      acc.carbs += m.totalCarbsG;
      acc.fat += m.totalFatG;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const totalFiberG = allItems.reduce(
    (s, i) => s + (i.fiberG !== null ? Number(i.fiberG) : 0),
    0,
  );

  res.json(
    GetDailyNutritionResponse.parse({
      date,
      totalCalories: Math.round(totals.calories * 10) / 10,
      totalProteinG: Math.round(totals.protein * 10) / 10,
      totalCarbsG: Math.round(totals.carbs * 10) / 10,
      totalFatG: Math.round(totals.fat * 10) / 10,
      totalFiberG: Math.round(totalFiberG * 10) / 10,
      mealCount: meals.length,
      meals: mealsWithItems,
    }),
  );
});

router.get("/nutrition/targets", requireAuth, async (req, res): Promise<void> => {
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, req.auth!.userId));

  if (!profile) {
    res.status(404).json({ error: "Profile not found — create a profile first to get targets" });
    return;
  }

  const weight = profile.weightKg ? Number(profile.weightKg) : null;
  const height = profile.heightCm ? Number(profile.heightCm) : null;
  const age = profile.age ?? null;
  const gender = profile.gender ?? "other";

  if (!weight || !height || !age) {
    // Return reasonable defaults when profile is incomplete
    res.json(
      GetNutritionTargetsResponse.parse({
        dailyCalories: 2000,
        proteinG: 150,
        carbsG: 200,
        fatG: 67,
        fiberG: 25,
        bmr: 0,
        tdee: 0,
      }),
    );
    return;
  }

  // Mifflin-St Jeor equation
  let bmr: number;
  if (gender === "male") {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else if (gender === "female") {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  } else {
    // Average for other/unspecified
    bmr = 10 * weight + 6.25 * height - 5 * age - 78;
  }

  const multiplier = ACTIVITY_MULTIPLIERS[profile.activityLevel ?? "sedentary"] ?? 1.2;
  const tdee = bmr * multiplier;

  const goalAdjustment = GOAL_CALORIE_ADJUSTMENTS[profile.fitnessGoal ?? "maintain"] ?? 0;
  const dailyCalories = Math.round(tdee + goalAdjustment);

  // Macro split based on goal
  let proteinPct = 0.3;
  let carbsPct = 0.4;
  let fatPct = 0.3;

  if (profile.fitnessGoal === "lose_weight") {
    proteinPct = 0.35; carbsPct = 0.35; fatPct = 0.3;
  } else if (profile.fitnessGoal === "gain_muscle") {
    proteinPct = 0.3; carbsPct = 0.45; fatPct = 0.25;
  }

  const proteinG = Math.round((dailyCalories * proteinPct) / 4);
  const carbsG = Math.round((dailyCalories * carbsPct) / 4);
  const fatG = Math.round((dailyCalories * fatPct) / 9);
  const fiberG = gender === "male" ? 38 : 25;

  res.json(
    GetNutritionTargetsResponse.parse({
      dailyCalories,
      proteinG,
      carbsG,
      fatG,
      fiberG,
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
    }),
  );
});

export default router;
