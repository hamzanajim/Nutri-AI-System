import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const profilesTable = pgTable("profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .unique()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name"),
  age: integer("age"),
  gender: text("gender"), // male | female | other
  heightCm: numeric("height_cm"),
  weightKg: numeric("weight_kg"),
  goalWeight: numeric("goal_weight"),
  fitnessGoal: text("fitness_goal"), // lose_fat | maintain | gain_muscle | improve_health
  activityLevel: text("activity_level"), // sedentary | lightly_active | moderately_active | very_active | extremely_active
  workoutFrequency: integer("workout_frequency"), // gym sessions per week 0-7
  workoutTypes: text("workout_types").array().notNull().default([]),
  mealFrequency: integer("meal_frequency"), // meals per day
  shoppingFrequency: text("shopping_frequency"), // weekly | biweekly | monthly | custom
  dietPreferences: text("diet_preferences").array().notNull().default([]),
  favoriteFoods: text("favorite_foods").array().notNull().default([]),
  foodsToAvoid: text("foods_to_avoid").array().notNull().default([]),
  allergies: text("allergies").array().notNull().default([]),
  foodIntolerances: text("food_intolerances").array().notNull().default([]),
  digestiveIssues: text("digestive_issues").array().notNull().default([]),
  healthConditions: text("health_conditions").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProfileSchema = createInsertSchema(profilesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profilesTable.$inferSelect;
