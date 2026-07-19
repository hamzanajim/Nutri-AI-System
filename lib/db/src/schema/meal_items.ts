import { pgTable, serial, integer, text, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { mealsTable } from "./meals";
import { foodsTable } from "./foods";

export const mealItemsTable = pgTable("meal_items", {
  id: serial("id").primaryKey(),
  mealId: integer("meal_id")
    .notNull()
    .references(() => mealsTable.id, { onDelete: "cascade" }),
  foodId: integer("food_id").references(() => foodsTable.id, { onDelete: "set null" }),
  // Denormalized for flexibility (user may enter custom food name)
  foodName: text("food_name").notNull(),
  quantityG: numeric("quantity_g").notNull(),
  calories: numeric("calories").notNull(),
  proteinG: numeric("protein_g").notNull(),
  carbsG: numeric("carbs_g").notNull(),
  fatG: numeric("fat_g").notNull(),
  fiberG: numeric("fiber_g"),
});

export const insertMealItemSchema = createInsertSchema(mealItemsTable).omit({
  id: true,
});

export type InsertMealItem = z.infer<typeof insertMealItemSchema>;
export type MealItem = typeof mealItemsTable.$inferSelect;
