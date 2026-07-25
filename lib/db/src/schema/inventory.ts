import { pgTable, serial, integer, text, numeric, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { foodsTable } from "./foods";

export const inventoryTable = pgTable("inventory", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  foodId: integer("food_id").references(() => foodsTable.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  // Category: protein | carbs | vegetables | fruits | dairy | fats | pantry | drinks | supplements
  category: text("category"),
  quantity: numeric("quantity").notNull(),
  unit: text("unit").notNull(), // g | kg | ml | L | pieces | servings | oz | lbs
  // Storage location: fridge | freezer | pantry
  storageLocation: text("storage_location"),
  // Expiry date (kept as expiryDate in DB for backward compat, exposed as expirationDate in API)
  expiryDate: date("expiry_date", { mode: "string" }),
  // Nutrition per 100g (auto-filled from food DB or AI suggestion)
  caloriesPer100g: numeric("calories_per_100g"),
  proteinPer100g: numeric("protein_per_100g"),
  carbsPer100g: numeric("carbs_per_100g"),
  fatPer100g: numeric("fat_per_100g"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertInventorySchema = createInsertSchema(inventoryTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertInventory = z.infer<typeof insertInventorySchema>;
export type InventoryItem = typeof inventoryTable.$inferSelect;
