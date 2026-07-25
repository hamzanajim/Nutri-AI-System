import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, profilesTable, inventoryTable } from "@workspace/db";
import { AnalyzeMealBody, AnalyzeMealResponse, NutritionChatBody, NutritionChatResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";
import { openai } from "@workspace/integrations-openai-ai-server";
import { generateMealPlanWithAI } from "./ai-meal-planner.js";

const router: IRouter = Router();

// ── Analyze Meal (existing) ───────────────────────────────────────────────────

router.post("/ai/analyze", requireAuth, async (req, res): Promise<void> => {
  const parsed = AnalyzeMealBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { description } = parsed.data as { description: string };
  req.log.info({ description }, "AI meal analysis requested");

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      max_completion_tokens: 1024,
      messages: [
        {
          role: "system",
          content: `You are a nutritionist AI. Analyze a meal description and return nutritional info as JSON:
{"items":[{"name":"...","estimatedQuantityG":100,"estimatedCalories":200,"estimatedProteinG":10,"estimatedCarbsG":25,"estimatedFatG":8}],"totalCalories":200,"totalProteinG":10,"totalCarbsG":25,"totalFatG":8,"notes":"..."}`,
        },
        { role: "user", content: `Analyze this meal: ${description}` },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const data = JSON.parse(content);
    res.json(AnalyzeMealResponse.parse(data));
  } catch (err) {
    logger.error({ err }, "AI analyze error");
    res.status(500).json({ error: "AI analysis failed" });
  }
});

// ── Nutrition Chat (existing) ─────────────────────────────────────────────────

router.post("/ai/chat", requireAuth, async (req, res): Promise<void> => {
  const parsed = NutritionChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { messages, includeProfile } = parsed.data as {
    messages: { role: string; content: string }[];
    includeProfile?: boolean;
  };

  req.log.info({ messageCount: messages.length }, "AI nutrition chat requested");

  let profileContext = "";
  if (includeProfile !== false) {
    const [profile] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, req.auth!.userId));
    if (profile) {
      profileContext = `User profile: goal=${profile.fitnessGoal}, activity=${profile.activityLevel}, diet=${(profile.dietPreferences ?? []).join(",")}, allergies=${(profile.allergies ?? []).join(",")}.`;
    }
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      max_completion_tokens: 1024,
      messages: [
        {
          role: "system",
          content: `You are a personalized AI nutrition coach. ${profileContext} Provide helpful, evidence-based nutrition guidance. Never diagnose medical conditions.`,
        },
        ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ],
    });

    const reply = response.choices[0]?.message?.content ?? "I'm sorry, I couldn't generate a response.";
    res.json(NutritionChatResponse.parse({ message: reply, role: "assistant" }));
  } catch (err) {
    logger.error({ err }, "AI chat error");
    res.status(500).json({ error: "AI chat failed" });
  }
});

// ── Generate Meal Plan ────────────────────────────────────────────────────────

router.post("/ai/generate-meal-plan", requireAuth, async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  const { date, mealCount = 3, notes = "" } = req.body as {
    date: string;
    mealCount?: number;
    notes?: string;
  };

  if (!date) {
    res.status(400).json({ error: "date is required" });
    return;
  }

  req.log.info({ userId, date, mealCount }, "AI meal plan generation requested");

  try {
    const planWithMeals = await generateMealPlanWithAI(userId, date, mealCount, notes);

    // Rebuild full plan detail for response
    const { default: mealPlansRouter } = await import("./meal-plans.js");
    void mealPlansRouter; // just to avoid unused import warning

    // Fetch the saved plan from DB to return full serialized form
    const { mealPlansTable: mpt, mealPlanMealsTable: mpmt, mealPlanIngredientsTable: mpit } = await import("@workspace/db");
    const { sql } = await import("drizzle-orm");

    const savedMeals = await db
      .select()
      .from(mpmt)
      .where(eq(mpmt.planId, planWithMeals.id))
      .orderBy(mpmt.id);

    const savedMealIds = savedMeals.map((m) => m.id);
    const allIngredients =
      savedMealIds.length > 0
        ? await db
            .select()
            .from(mpit)
            .where(sql`${mpit.mealId} = ANY(${sql.raw(`ARRAY[${savedMealIds.join(",")}]`)})`)
        : [];

    const ingByMeal = new Map<number, (typeof mpit.$inferSelect)[]>();
    for (const ing of allIngredients) {
      const list = ingByMeal.get(ing.mealId) ?? [];
      list.push(ing);
      ingByMeal.set(ing.mealId, list);
    }

    const serializedMeals = savedMeals.map((m) => ({
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

    const totalCalories = serializedMeals.reduce((s, m) => s + (m.calories ?? 0), 0);
    const totalProteinG = serializedMeals.reduce((s, m) => s + (m.proteinG ?? 0), 0);
    const totalCarbsG = serializedMeals.reduce((s, m) => s + (m.carbsG ?? 0), 0);
    const totalFatG = serializedMeals.reduce((s, m) => s + (m.fatG ?? 0), 0);

    res.status(201).json({
      id: planWithMeals.id,
      userId: planWithMeals.userId,
      date: planWithMeals.date,
      name: planWithMeals.name,
      status: planWithMeals.status,
      meals: serializedMeals,
      totalCalories,
      totalProteinG,
      totalCarbsG,
      totalFatG,
      createdAt: planWithMeals.createdAt.toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "AI meal plan generation error");
    res.status(500).json({ error: "Failed to generate meal plan. Please try again." });
  }
});

// ── Replace Ingredient ────────────────────────────────────────────────────────

router.post("/ai/replace-ingredient", requireAuth, async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  const { ingredientName, category, mealPlanIngredientId } = req.body as {
    ingredientName: string;
    category?: string;
    mealPlanIngredientId?: number;
  };

  if (!ingredientName) {
    res.status(400).json({ error: "ingredientName is required" });
    return;
  }

  // Fetch available inventory
  const inventory = await db
    .select()
    .from(inventoryTable)
    .where(and(eq(inventoryTable.userId, userId)));

  const available = inventory
    .filter((i) => Number(i.quantity) > 0)
    .map(
      (i) =>
        `${i.name} (qty: ${i.quantity}${i.unit}, category: ${i.category ?? "unknown"}${
          i.caloriesPer100g ? `, ${i.caloriesPer100g} kcal/100g` : ""
        }${i.proteinPer100g ? `, protein: ${i.proteinPer100g}g/100g` : ""})`
    );

  if (available.length === 0) {
    res.json({
      found: false,
      replacementName: null,
      replacementInventoryItemId: null,
      quantityG: null,
      reason: "No items available in your inventory to use as a replacement.",
    });
    return;
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      max_completion_tokens: 512,
      messages: [
        {
          role: "system",
          content: `You are a nutritionist AI. Find the best replacement ingredient from the available inventory.
Return ONLY JSON: {"found":true/false,"replacementName":"...","reason":"..."}
If no suitable replacement exists, set found=false.`,
        },
        {
          role: "user",
          content: `The ingredient "${ingredientName}"${category ? ` (category: ${category})` : ""} is unavailable.
Find the best replacement from this inventory:
${available.join("\n")}
Choose a replacement that is nutritionally similar and from the same category if possible.
Explain why it's a good substitute.`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const result = JSON.parse(content) as {
      found: boolean;
      replacementName?: string;
      reason: string;
    };

    if (!result.found || !result.replacementName) {
      res.json({
        found: false,
        replacementName: null,
        replacementInventoryItemId: null,
        quantityG: null,
        reason: result.reason ?? "No suitable replacement found in your inventory.",
      });
      return;
    }

    // Find the matching inventory item
    const matchedItem = inventory.find(
      (i) =>
        i.name.toLowerCase() === result.replacementName!.toLowerCase() ||
        i.name.toLowerCase().includes(result.replacementName!.toLowerCase()) ||
        result.replacementName!.toLowerCase().includes(i.name.toLowerCase())
    );

    res.json({
      found: true,
      replacementName: result.replacementName,
      replacementInventoryItemId: matchedItem?.id ?? null,
      quantityG: matchedItem ? Number(matchedItem.quantity) : null,
      reason: result.reason,
    });
  } catch (err) {
    logger.error({ err }, "AI replace ingredient error");
    res.status(500).json({ error: "Failed to find replacement. Please try again." });
  }
});

export default router;
