import { pgTable, serial, integer, text, numeric, boolean, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { inventoryTable } from "./inventory";

export const mealPlansTable = pgTable("meal_plans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  date: date("date", { mode: "string" }).notNull(),
  name: text("name").notNull().default("Daily Plan"),
  status: text("status").notNull().default("active"), // draft | active
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const mealPlanMealsTable = pgTable("meal_plan_meals", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id")
    .notNull()
    .references(() => mealPlansTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  mealType: text("meal_type").notNull(), // breakfast | lunch | dinner | snack
  scheduledTime: text("scheduled_time"), // e.g. "08:00"
  calories: numeric("calories"),
  proteinG: numeric("protein_g"),
  carbsG: numeric("carbs_g"),
  fatG: numeric("fat_g"),
  notes: text("notes"),
  prepInstructions: text("prep_instructions"), // cooking steps from AI
  cookingTimeMinutes: integer("cooking_time_minutes"),
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const mealPlanIngredientsTable = pgTable("meal_plan_ingredients", {
  id: serial("id").primaryKey(),
  mealId: integer("meal_id")
    .notNull()
    .references(() => mealPlanMealsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  quantityG: numeric("quantity_g").notNull(),
  unit: text("unit").notNull().default("g"),
  available: boolean("available").notNull().default(true),
  inventoryItemId: integer("inventory_item_id").references(() => inventoryTable.id, { onDelete: "set null" }),
  substituteFor: text("substitute_for"), // original ingredient name if this is a replacement
  substituteReason: text("substitute_reason"), // why the replacement was made
});

export const insertMealPlanSchema = createInsertSchema(mealPlansTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertMealPlanMealSchema = createInsertSchema(mealPlanMealsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertMealPlanIngredientSchema = createInsertSchema(mealPlanIngredientsTable).omit({ id: true });

export type InsertMealPlan = z.infer<typeof insertMealPlanSchema>;
export type MealPlan = typeof mealPlansTable.$inferSelect;
export type InsertMealPlanMeal = z.infer<typeof insertMealPlanMealSchema>;
export type MealPlanMeal = typeof mealPlanMealsTable.$inferSelect;
export type InsertMealPlanIngredient = z.infer<typeof insertMealPlanIngredientSchema>;
export type MealPlanIngredient = typeof mealPlanIngredientsTable.$inferSelect;
