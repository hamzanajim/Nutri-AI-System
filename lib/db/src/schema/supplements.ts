import { pgTable, serial, integer, text, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const supplementsTable = pgTable("supplements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  dose: numeric("dose").notNull(),          // amount per serving
  unit: text("unit").notNull(),              // g | mg | ml | capsules | tablets | servings
  frequency: text("frequency").notNull(),   // daily | weekly | custom
  scheduleTimes: text("schedule_times").array(), // ["08:00", "20:00"]
  currentQuantity: numeric("current_quantity"),  // how much is left
  quantityUnit: text("quantity_unit"),           // g | mg | capsules | tablets
  reminderEnabled: boolean("reminder_enabled").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSupplementSchema = createInsertSchema(supplementsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSupplement = z.infer<typeof insertSupplementSchema>;
export type Supplement = typeof supplementsTable.$inferSelect;
