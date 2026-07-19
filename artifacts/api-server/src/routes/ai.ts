import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, profilesTable } from "@workspace/db";
import { AnalyzeMealBody, AnalyzeMealResponse, NutritionChatBody, NutritionChatResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/**
 * AI routes — architecture is ready for LLM integration.
 * To activate: set OPENAI_API_KEY (or ANTHROPIC_API_KEY) as a secret
 * and replace the stub responses with real API calls.
 */

router.post("/ai/analyze", requireAuth, async (req, res): Promise<void> => {
  const parsed = AnalyzeMealBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { description } = parsed.data as { description: string };
  req.log.info({ description }, "AI meal analysis requested");

  // Stub: Architecture is wired and ready.
  // Replace this block with an actual OpenAI / Anthropic call when keys are configured.
  // Example shape that matches the MealAnalysisResult schema:
  const stubResult = {
    items: [
      {
        name: "Item from: " + description.slice(0, 30),
        estimatedQuantityG: 100,
        estimatedCalories: 200,
        estimatedProteinG: 10,
        estimatedCarbsG: 25,
        estimatedFatG: 8,
      },
    ],
    totalCalories: 200,
    totalProteinG: 10,
    totalCarbsG: 25,
    totalFatG: 8,
    notes:
      "AI analysis is ready to be activated. Add your OpenAI or Anthropic API key to enable real nutritional analysis.",
  };

  res.json(AnalyzeMealResponse.parse(stubResult));
});

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

  // Fetch profile context if requested (used to personalize AI responses)
  let _profileContext: object | null = null;
  if (includeProfile !== false) {
    const [profile] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, req.auth!.userId));
    if (profile) {
      _profileContext = {
        fitnessGoal: profile.fitnessGoal,
        activityLevel: profile.activityLevel,
        dietPreferences: profile.dietPreferences,
        allergies: profile.allergies,
        healthConditions: profile.healthConditions,
      };
    }
  }

  logger.debug({ profileContext: _profileContext }, "Profile context loaded for AI chat");

  // Stub response — architecture is fully wired and ready for AI integration.
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

  const stubReply =
    `I received your message: "${lastUserMessage.slice(0, 50)}...". ` +
    `AI integration is ready to activate — add your OpenAI or Anthropic API key to enable ` +
    `personalized nutrition coaching.`;

  res.json(
    NutritionChatResponse.parse({
      message: stubReply,
      role: "assistant",
    }),
  );
});

export default router;
