import { pgTable, serial, integer, text, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const foodsTable = pgTable("foods", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  brand: text("brand"),
  caloriesPer100g: numeric("calories_per_100g").notNull(),
  proteinPer100g: numeric("protein_per_100g").notNull(),
  carbsPer100g: numeric("carbs_per_100g").notNull(),
  fatPer100g: numeric("fat_per_100g").notNull(),
  fiberPer100g: numeric("fiber_per_100g"),
  servingSize: numeric("serving_size"),
  servingUnit: text("serving_unit"),
  isCustom: boolean("is_custom").notNull().default(false),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFoodSchema = createInsertSchema(foodsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertFood = z.infer<typeof insertFoodSchema>;
export type Food = typeof foodsTable.$inferSelect;
