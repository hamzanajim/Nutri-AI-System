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
});

export const insertGroceryListItemSchema = createInsertSchema(groceryListItemsTable).omit({
  id: true,
});

export type InsertGroceryListItem = z.infer<typeof insertGroceryListItemSchema>;
export type GroceryListItem = typeof groceryListItemsTable.$inferSelect;
