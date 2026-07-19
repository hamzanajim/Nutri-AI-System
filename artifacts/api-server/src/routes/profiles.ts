import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, profilesTable } from "@workspace/db";
import {
  GetMyProfileResponse,
  CreateMyProfileBody,
  UpdateMyProfileBody,
  CreateMyProfileResponse,
  UpdateMyProfileResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function serializeProfile(p: typeof profilesTable.$inferSelect) {
  return {
    id: p.id,
    userId: p.userId,
    name: p.name ?? null,
    age: p.age ?? null,
    gender: p.gender ?? null,
    heightCm: p.heightCm !== null ? Number(p.heightCm) : null,
    weightKg: p.weightKg !== null ? Number(p.weightKg) : null,
    goalWeight: p.goalWeight !== null ? Number(p.goalWeight) : null,
    fitnessGoal: p.fitnessGoal ?? null,
    activityLevel: p.activityLevel ?? null,
    workoutFrequency: p.workoutFrequency ?? null,
    workoutTypes: p.workoutTypes ?? [],
    mealFrequency: p.mealFrequency ?? null,
    shoppingFrequency: p.shoppingFrequency ?? null,
    dietPreferences: p.dietPreferences ?? [],
    favoriteFoods: p.favoriteFoods ?? [],
    foodsToAvoid: p.foodsToAvoid ?? [],
    allergies: p.allergies ?? [],
    foodIntolerances: p.foodIntolerances ?? [],
    healthConditions: p.healthConditions ?? [],
    digestiveIssues: p.digestiveIssues ?? [],
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function extractProfileValues(data: Record<string, unknown>) {
  const v: Record<string, unknown> = {};
  if (data.name !== undefined) v.name = data.name;
  if (data.age !== undefined) v.age = data.age;
  if (data.gender !== undefined) v.gender = data.gender;
  if (data.heightCm !== undefined) v.heightCm = data.heightCm !== null ? String(data.heightCm) : null;
  if (data.weightKg !== undefined) v.weightKg = data.weightKg !== null ? String(data.weightKg) : null;
  if (data.goalWeight !== undefined) v.goalWeight = data.goalWeight !== null ? String(data.goalWeight) : null;
  if (data.fitnessGoal !== undefined) v.fitnessGoal = data.fitnessGoal;
  if (data.activityLevel !== undefined) v.activityLevel = data.activityLevel;
  if (data.workoutFrequency !== undefined) v.workoutFrequency = data.workoutFrequency;
  if (data.workoutTypes !== undefined) v.workoutTypes = data.workoutTypes;
  if (data.mealFrequency !== undefined) v.mealFrequency = data.mealFrequency;
  if (data.shoppingFrequency !== undefined) v.shoppingFrequency = data.shoppingFrequency;
  if (data.dietPreferences !== undefined) v.dietPreferences = data.dietPreferences;
  if (data.favoriteFoods !== undefined) v.favoriteFoods = data.favoriteFoods;
  if (data.foodsToAvoid !== undefined) v.foodsToAvoid = data.foodsToAvoid;
  if (data.allergies !== undefined) v.allergies = data.allergies;
  if (data.foodIntolerances !== undefined) v.foodIntolerances = data.foodIntolerances;
  if (data.healthConditions !== undefined) v.healthConditions = data.healthConditions;
  if (data.digestiveIssues !== undefined) v.digestiveIssues = data.digestiveIssues;
  return v;
}

router.get("/profiles/me", requireAuth, async (req, res): Promise<void> => {
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, req.auth!.userId));

  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  res.json(GetMyProfileResponse.parse(serializeProfile(profile)));
});

router.post("/profiles/me", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateMyProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select({ id: profilesTable.id })
    .from(profilesTable)
    .where(eq(profilesTable.userId, req.auth!.userId));

  if (existing) {
    res.status(400).json({ error: "Profile already exists. Use PATCH to update." });
    return;
  }

  const data = parsed.data as Record<string, unknown>;
  const values = extractProfileValues(data);

  const [profile] = await db
    .insert(profilesTable)
    .values({ userId: req.auth!.userId, ...values })
    .returning();

  res.status(201).json(CreateMyProfileResponse.parse(serializeProfile(profile)));
});

router.patch("/profiles/me", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateMyProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data as Record<string, unknown>;
  const updates = extractProfileValues(data);

  const [profile] = await db
    .update(profilesTable)
    .set(updates)
    .where(eq(profilesTable.userId, req.auth!.userId))
    .returning();

  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  res.json(UpdateMyProfileResponse.parse(serializeProfile(profile)));
});

export default router;
