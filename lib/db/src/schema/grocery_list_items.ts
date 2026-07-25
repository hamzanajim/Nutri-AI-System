import { pgTable, serial, integer, text, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { groceryListsTable } from "./grocery_lists";

export const groceryListItemsTable = pgTable("grocery_list_items", {
  id: serial("id").primaryKey(),
  listId: integer("list_id")
    .notNull()
    .references(() => groceryListsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  quantity: numeric("quantity"),
  unit: text("unit"),
  checked: boolean("checked").notNull().default(false),
  notes: text("notes"),
  // Smart grocery fields (AI-populated)
  currentQty: numeric("current_qty"),    // what's in inventory now
  requiredQty: numeric("required_qty"),  // what the meal plan needs
  toBuyQty: numeric("to_buy_qty"),       // calculated: requiredQty - currentQty
  reason: text("reason"),               // "Needed for 5 meals this week"
  category: text("category"),           // food category for grouping
  aiGenerated: boolean("ai_generated").notNull().default(false),
});

export const insertGroceryListItemSchema = createInsertSchema(groceryListItemsTable).omit({
  id: true,
});

export type InsertGroceryListItem = z.infer<typeof insertGroceryListItemSchema>;
export type GroceryListItem = typeof groceryListItemsTable.$inferSelect;
