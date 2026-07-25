import { Router, type IRouter } from "express";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import {
  db,
  mealPlansTable,
  mealPlanMealsTable,
  mealPlanIngredientsTable,
  mealsTable,
  mealItemsTable,
  supplementsTable,
  inventoryTable,
  profilesTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function calcNutritionTargets(profile: typeof profilesTable.$inferSelect | undefined) {
  if (!profile || !profile.weightKg || !profile.heightCm || !profile.age) {
    return { dailyCalories: 2000, proteinG: 150, carbsG: 200, fatG: 65 };
  }
  const weight = Number(profile.weightKg);
  const height = Number(profile.heightCm);
  const age = Number(profile.age);
  const gender = profile.gender ?? "male";

  // Mifflin-St Jeor
  let bmr =
    gender === "female"
      ? 10 * weight + 6.25 * height - 5 * age - 161
      : 10 * weight + 6.25 * height - 5 * age + 5;

  const activityMap: Record<string, number> = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    very_active: 1.725,
    extremely_active: 1.9,
  };
  const multiplier = activityMap[profile.activityLevel ?? "sedentary"] ?? 1.2;
  let tdee = bmr * multiplier;

  const goalMap: Record<string, number> = {
    lose_fat: -500,
    maintain: 0,
    gain_muscle: 300,
    improve_health: -200,
  };
  tdee += goalMap[profile.fitnessGoal ?? "maintain"] ?? 0;

  return {
    dailyCalories: Math.round(tdee),
    proteinG: Math.round((tdee * 0.3) / 4),
    carbsG: Math.round((tdee * 0.4) / 4),
    fatG: Math.round((tdee * 0.3) / 9),
  };
}

function calcDaysRemaining(currentQuantity: string | null, dose: string, frequency: string) {
  if (!currentQuantity || !dose) return null;
  const qty = Number(currentQuantity);
  const d = Number(dose);
  if (d <= 0 || qty <= 0) return null;
  if (frequency === "weekly") return Math.floor((qty / d) * 7);
  return Math.floor(qty / d);
}

function serializeSupplement(s: typeof supplementsTable.$inferSelect) {
  return {
    id: s.id,
    userId: s.userId,
    name: s.name,
    dose: Number(s.dose),
    unit: s.unit,
    frequency: s.frequency,
    scheduleTimes: s.scheduleTimes ?? [],
    currentQuantity: s.currentQuantity !== null ? Number(s.currentQuantity) : null,
    quantityUnit: s.quantityUnit ?? null,
    reminderEnabled: s.reminderEnabled,
    notes: s.notes ?? null,
    daysRemaining: calcDaysRemaining(s.currentQuantity, s.dose, s.frequency),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

router.get("/dashboard/today", requireAuth, async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  const today = (req.query.date as string) ?? new Date().toISOString().split("T")[0];
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  // Run all queries in parallel
  const [profile, todayMeals, mealPlanRows, supplements, lowInventory, expiringItems, freezerItems] =
    await Promise.all([
      // Profile for nutrition targets
      db.select().from(profilesTable).where(eq(profilesTable.userId, userId)).then((r) => r[0]),

      // Logged meals today
      db
        .select()
        .from(mealsTable)
        .where(and(eq(mealsTable.userId, userId), eq(mealsTable.date, today))),

      // Meal plan for today
      db
        .select()
        .from(mealPlansTable)
        .where(and(eq(mealPlansTable.userId, userId), eq(mealPlansTable.date, today)))
        .limit(1),

      // Supplements
      db.select().from(supplementsTable).where(eq(supplementsTable.userId, userId)).orderBy(supplementsTable.name),

      // Low inventory items (quantity < 100 for g/ml, < 3 for pieces/servings)
      db
        .select()
        .from(inventoryTable)
        .where(
          and(
            eq(inventoryTable.userId, userId),
            sql`CAST(${inventoryTable.quantity} AS NUMERIC) < CASE 
              WHEN ${inventoryTable.unit} IN ('pieces', 'servings', 'capsules', 'tablets') THEN 3 
              ELSE 100 
            END`
          )
        )
        .limit(10),

      // Expiring within 3 days
      db
        .select()
        .from(inventoryTable)
        .where(
          and(
            eq(inventoryTable.userId, userId),
            sql`${inventoryTable.expiryDate} IS NOT NULL`,
            sql`${inventoryTable.expiryDate} <= ${tomorrowStr}::date + interval '3 days'`,
            sql`${inventoryTable.expiryDate} >= ${today}`
          )
        )
        .limit(10),

      // Freezer items needed for tomorrow's meals
      db
        .select()
        .from(inventoryTable)
        .where(
          and(eq(inventoryTable.userId, userId), eq(inventoryTable.storageLocation, "freezer"))
        )
        .limit(20),
    ]);

  // Fetch meal items for logged meals
  const mealIds = todayMeals.map((m) => m.id);
  const allItems =
    mealIds.length > 0
      ? await db
          .select()
          .from(mealItemsTable)
          .where(sql`${mealItemsTable.mealId} = ANY(${sql.raw(`ARRAY[${mealIds.join(",")}]`)})`)
      : [];

  const itemsByMeal = new Map<number, (typeof mealItemsTable.$inferSelect)[]>();
  for (const item of allItems) {
    const list = itemsByMeal.get(item.mealId) ?? [];
    list.push(item);
    itemsByMeal.set(item.mealId, list);
  }

  const loggedMeals = todayMeals.map((meal) => {
    const items = itemsByMeal.get(meal.id) ?? [];
    return {
      id: meal.id,
      name: meal.name,
      mealType: meal.mealType,
      date: meal.date,
      notes: meal.notes ?? null,
      totalCalories: items.reduce((s, i) => s + Number(i.calories), 0),
      totalProteinG: items.reduce((s, i) => s + Number(i.proteinG), 0),
      totalCarbsG: items.reduce((s, i) => s + Number(i.carbsG), 0),
      totalFatG: items.reduce((s, i) => s + Number(i.fatG), 0),
      totalFiberG: items.reduce((s, i) => s + Number(i.fiberG), 0),
      mealCount: items.length,
      items: items.map((i) => ({
        id: i.id,
        foodId: i.foodId ?? null,
        foodName: i.foodName,
        quantityG: Number(i.quantityG),
        calories: Number(i.calories),
        proteinG: Number(i.proteinG),
        carbsG: Number(i.carbsG),
        fatG: Number(i.fatG),
        fiberG: Number(i.fiberG),
      })),
    };
  });

  // Nutrition totals
  const consumed = loggedMeals.reduce((s, m) => s + m.totalCalories, 0);
  const proteinConsumed = loggedMeals.reduce((s, m) => s + m.totalProteinG, 0);
  const carbsConsumed = loggedMeals.reduce((s, m) => s + m.totalCarbsG, 0);
  const fatConsumed = loggedMeals.reduce((s, m) => s + m.totalFatG, 0);

  const targets = calcNutritionTargets(profile);

  // Build today's meal plan detail
  let mealPlanDetail = null;
  if (mealPlanRows.length > 0) {
    const plan = mealPlanRows[0];
    const planMeals = await db
      .select()
      .from(mealPlanMealsTable)
      .where(eq(mealPlanMealsTable.planId, plan.id))
      .orderBy(mealPlanMealsTable.id);

    const planMealIds = planMeals.map((m) => m.id);
    const planIngredients =
      planMealIds.length > 0
        ? await db
            .select()
            .from(mealPlanIngredientsTable)
            .where(
              sql`${mealPlanIngredientsTable.mealId} = ANY(${sql.raw(`ARRAY[${planMealIds.join(",")}]`)})`
            )
        : [];

    const ingByMeal = new Map<number, (typeof mealPlanIngredientsTable.$inferSelect)[]>();
    for (const ing of planIngredients) {
      const list = ingByMeal.get(ing.mealId) ?? [];
      list.push(ing);
      ingByMeal.set(ing.mealId, list);
    }

    const serializedMeals = planMeals.map((m) => ({
      id: m.id,
      planId: m.planId,
      name: m.name,
      mealType: m.mealType,
      scheduledTime: m.scheduledTime ?? null,
      calories: m.calories !== null ? Number(m.calories) : null,
      proteinG: m.proteinG !== null ? Number(m.proteinG) : null,
      carbsG: m.carbsG !== null ? Number(m.carbsG) : null,
      fatG: m.fatG !== null ? Number(m.fatG) : null,
      notes: m.notes ?? null,
      prepInstructions: m.prepInstructions ?? null,
      cookingTimeMinutes: m.cookingTimeMinutes ?? null,
      completed: m.completed,
      completedAt: m.completedAt?.toISOString() ?? null,
      ingredients: (ingByMeal.get(m.id) ?? []).map((ing) => ({
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
    }));

    mealPlanDetail = {
      id: plan.id,
      userId: plan.userId,
      date: plan.date,
      name: plan.name,
      status: plan.status,
      meals: serializedMeals,
      totalCalories: serializedMeals.reduce((s, m) => s + (m.calories ?? 0), 0),
      totalProteinG: serializedMeals.reduce((s, m) => s + (m.proteinG ?? 0), 0),
      totalCarbsG: serializedMeals.reduce((s, m) => s + (m.carbsG ?? 0), 0),
      totalFatG: serializedMeals.reduce((s, m) => s + (m.fatG ?? 0), 0),
      createdAt: plan.createdAt.toISOString(),
    };
  }

  // Build inventory alerts
  const inventoryAlerts = [
    ...lowInventory.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: Number(item.quantity),
      unit: item.unit,
      alertType: "low" as const,
      message: `${item.name} is running low (${Number(item.quantity)}${item.unit})`,
      daysUntilExpiry: null,
    })),
    ...expiringItems.map((item) => {
      const expiry = new Date(item.expiryDate!);
      const now = new Date(today);
      const days = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: item.id,
        name: item.name,
        quantity: Number(item.quantity),
        unit: item.unit,
        alertType: "expiring" as const,
        message:
          days <= 0
            ? `${item.name} expired!`
            : days === 1
              ? `${item.name} expires tomorrow`
              : `${item.name} expires in ${days} days`,
        daysUntilExpiry: days,
      };
    }),
  ];

  // Low supplement alerts folded into inventory alerts
  const lowSupplements = supplements
    .filter((s) => {
      const days = calcDaysRemaining(s.currentQuantity, s.dose, s.frequency);
      return days !== null && days <= 7;
    })
    .map((s) => ({
      id: s.id,
      name: s.name,
      quantity: s.currentQuantity !== null ? Number(s.currentQuantity) : 0,
      unit: s.quantityUnit ?? s.unit,
      alertType: "low" as const,
      message: `${s.name} supplement running low — estimated ${calcDaysRemaining(s.currentQuantity, s.dose, s.frequency)} days remaining`,
      daysUntilExpiry: null,
    }));

  inventoryAlerts.push(...lowSupplements);

  // Freezer prep alerts — items in freezer that match tomorrow's meal plan ingredients
  let freezerAlerts: typeof inventoryAlerts = [];
  if (mealPlanDetail) {
    const tomorrowPlan = await db
      .select()
      .from(mealPlansTable)
      .where(and(eq(mealPlansTable.userId, userId), eq(mealPlansTable.date, tomorrowStr)))
      .limit(1);

    if (tomorrowPlan.length > 0) {
      const tomorrowMeals = await db
        .select()
        .from(mealPlanMealsTable)
        .where(eq(mealPlanMealsTable.planId, tomorrowPlan[0].id));

      const tomorrowMealIds = tomorrowMeals.map((m) => m.id);
      if (tomorrowMealIds.length > 0) {
        const tomorrowIngredients = await db
          .select()
          .from(mealPlanIngredientsTable)
          .where(
            sql`${mealPlanIngredientsTable.mealId} = ANY(${sql.raw(`ARRAY[${tomorrowMealIds.join(",")}]`)})`
          );

        const tomorrowIngredientNames = new Set(
          tomorrowIngredients.map((i) => i.name.toLowerCase())
        );

        freezerAlerts = freezerItems
          .filter((item) => tomorrowIngredientNames.has(item.name.toLowerCase()))
          .map((item) => ({
            id: item.id,
            name: item.name,
            quantity: Number(item.quantity),
            unit: item.unit,
            alertType: "expiring" as const,
            message: `Move ${item.name} from freezer to fridge tonight — needed for tomorrow's meals`,
            daysUntilExpiry: 1,
          }));
      }
    }
  }

  res.json({
    date: today,
    nutrition: {
      consumed: Math.round(consumed),
      target: targets.dailyCalories,
      remaining: Math.max(0, targets.dailyCalories - Math.round(consumed)),
      proteinConsumed: Math.round(proteinConsumed),
      proteinTarget: targets.proteinG,
      carbsConsumed: Math.round(carbsConsumed),
      carbsTarget: targets.carbsG,
      fatConsumed: Math.round(fatConsumed),
      fatTarget: targets.fatG,
    },
    mealPlan: mealPlanDetail,
    loggedMeals,
    supplements: supplements.map(serializeSupplement),
    inventoryAlerts,
    freezerAlerts,
  });
});

export default router;
