import { pgTable, serial, integer, text, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const healthLogsTable = pgTable("health_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  date: date("date", { mode: "string" }).notNull(),
  // 1-5 scale ratings
  energy: integer("energy"),        // 1=exhausted 5=energized
  hunger: integer("hunger"),        // 1=not hungry 5=very hungry
  bloating: integer("bloating"),    // 1=none 5=severe
  gas: integer("gas"),              // 1=none 5=severe
  sleepQuality: integer("sleep_quality"), // 1=terrible 5=excellent
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHealthLogSchema = createInsertSchema(healthLogsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertHealthLog = z.infer<typeof insertHealthLogSchema>;
export type HealthLog = typeof healthLogsTable.$inferSelect;
