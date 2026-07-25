import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, healthLogsTable, mealsTable, inventoryTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

function serializeLog(log: typeof healthLogsTable.$inferSelect) {
  return {
    id: log.id,
    userId: log.userId,
    date: log.date,
    energy: log.energy ?? null,
    hunger: log.hunger ?? null,
    bloating: log.bloating ?? null,
    gas: log.gas ?? null,
    sleepQuality: log.sleepQuality ?? null,
    notes: log.notes ?? null,
    createdAt: log.createdAt.toISOString(),
  };
}

// GET /health-logs/patterns must come before /health-logs/:date if added
router.get("/health-logs/patterns", requireAuth, async (req, res): Promise<void> => {
  const userId = req.auth!.userId;

  const logs = await db
    .select()
    .from(healthLogsTable)
    .where(eq(healthLogsTable.userId, userId))
    .orderBy(desc(healthLogsTable.date))
    .limit(60);

  if (logs.length < 5) {
    res.json({
      patterns: [],
      suggestions: ["Log at least 5 days of health data to detect patterns."],
      dataPoints: logs.length,
    });
    return;
  }

  // Fetch recent meal history for context
  const recentMeals = await db
    .select()
    .from(mealsTable)
    .where(eq(mealsTable.userId, userId))
    .orderBy(desc(mealsTable.date))
    .limit(30);

  // Fetch inventory for allergen context
  const inventory = await db
    .select({ name: inventoryTable.name, category: inventoryTable.category })
    .from(inventoryTable)
    .where(eq(inventoryTable.userId, userId))
    .limit(30);

  const logSummary = logs.map((l) => ({
    date: l.date,
    energy: l.energy,
    hunger: l.hunger,
    bloating: l.bloating,
    gas: l.gas,
    sleep: l.sleepQuality,
    notes: l.notes,
  }));

  const mealSummary = recentMeals.map((m) => ({ date: m.date, meal: m.name, type: m.mealType }));

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      max_completion_tokens: 1024,
      messages: [
        {
          role: "system",
          content: `You are a nutrition and wellness assistant analyzing health log data. 
Identify patterns between food consumption and physical symptoms. 
NEVER diagnose medical conditions. Only provide observations and general suggestions.
Respond with JSON only: { "patterns": string[], "suggestions": string[] }`,
        },
        {
          role: "user",
          content: JSON.stringify({
            healthLogs: logSummary,
            recentMeals: mealSummary,
            inventoryItems: inventory.map((i) => i.name),
          }),
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as { patterns?: string[]; suggestions?: string[] };

    res.json({
      patterns: parsed.patterns ?? [],
      suggestions: parsed.suggestions ?? [],
      dataPoints: logs.length,
    });
  } catch {
    res.json({
      patterns: [],
      suggestions: ["Unable to analyze patterns at this time. Please try again later."],
      dataPoints: logs.length,
    });
  }
});

router.get("/health-logs", requireAuth, async (req, res): Promise<void> => {
  const limit = Math.min(parseInt((req.query.limit as string) ?? "30", 10), 90);

  const logs = await db
    .select()
    .from(healthLogsTable)
    .where(eq(healthLogsTable.userId, req.auth!.userId))
    .orderBy(desc(healthLogsTable.date))
    .limit(limit);

  res.json(logs.map(serializeLog));
});

router.post("/health-logs", requireAuth, async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  const body = req.body as {
    date?: string;
    energy?: number;
    hunger?: number;
    bloating?: number;
    gas?: number;
    sleepQuality?: number;
    notes?: string;
  };

  const today = new Date().toISOString().split("T")[0];
  const date = body.date ?? today;

  // Upsert: delete existing log for the date if it exists, then insert
  await db
    .delete(healthLogsTable)
    .where(and(eq(healthLogsTable.userId, userId), eq(healthLogsTable.date, date)));

  const [log] = await db
    .insert(healthLogsTable)
    .values({
      userId,
      date,
      energy: body.energy ?? null,
      hunger: body.hunger ?? null,
      bloating: body.bloating ?? null,
      gas: body.gas ?? null,
      sleepQuality: body.sleepQuality ?? null,
      notes: body.notes ?? null,
    })
    .returning();

  res.json(serializeLog(log));
});

export default router;
