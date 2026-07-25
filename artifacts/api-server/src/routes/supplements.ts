import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, supplementsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function calcDaysRemaining(
  currentQuantity: string | null,
  dose: string,
  frequency: string
): number | null {
  if (!currentQuantity || !dose) return null;
  const qty = Number(currentQuantity);
  const d = Number(dose);
  if (d <= 0 || qty <= 0) return null;
  // Daily: qty / dose
  // Weekly: qty / dose * 7
  if (frequency === "weekly") return Math.floor((qty / d) * 7);
  return Math.floor(qty / d); // daily or custom treated as daily
}

function serializeSupplement(s: typeof supplementsTable.$inferSelect) {
  return {
    id: s.id,
    userId: s.userId,
    name: s.name,
    dose: Number(s.dose),
    unit: s.unit,
    frequency: s.frequency,
    scheduleTimes: s.scheduleTimes ?? [],
    currentQuantity: s.currentQuantity !== null ? Number(s.currentQuantity) : null,
    quantityUnit: s.quantityUnit ?? null,
    reminderEnabled: s.reminderEnabled,
    notes: s.notes ?? null,
    daysRemaining: calcDaysRemaining(s.currentQuantity, s.dose, s.frequency),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

router.get("/supplements", requireAuth, async (req, res): Promise<void> => {
  const supplements = await db
    .select()
    .from(supplementsTable)
    .where(eq(supplementsTable.userId, req.auth!.userId))
    .orderBy(supplementsTable.name);

  res.json(supplements.map(serializeSupplement));
});

router.post("/supplements", requireAuth, async (req, res): Promise<void> => {
  const body = req.body as {
    name: string;
    dose: number;
    unit: string;
    frequency: string;
    scheduleTimes?: string[];
    currentQuantity?: number;
    quantityUnit?: string;
    reminderEnabled?: boolean;
    notes?: string;
  };

  if (!body.name || body.dose === undefined || !body.unit || !body.frequency) {
    res.status(400).json({ error: "name, dose, unit, and frequency are required" });
    return;
  }

  const [supp] = await db
    .insert(supplementsTable)
    .values({
      userId: req.auth!.userId,
      name: body.name,
      dose: String(body.dose),
      unit: body.unit,
      frequency: body.frequency,
      scheduleTimes: body.scheduleTimes ?? [],
      currentQuantity: body.currentQuantity !== undefined ? String(body.currentQuantity) : null,
      quantityUnit: body.quantityUnit ?? null,
      reminderEnabled: body.reminderEnabled ?? true,
      notes: body.notes ?? null,
    })
    .returning();

  res.status(201).json(serializeSupplement(supp));
});

router.patch("/supplements/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const body = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) updates.name = body.name;
  if (body.dose !== undefined) updates.dose = String(body.dose);
  if (body.unit !== undefined) updates.unit = body.unit;
  if (body.frequency !== undefined) updates.frequency = body.frequency;
  if (body.scheduleTimes !== undefined) updates.scheduleTimes = body.scheduleTimes;
  if (body.currentQuantity !== undefined)
    updates.currentQuantity = body.currentQuantity !== null ? String(body.currentQuantity) : null;
  if (body.quantityUnit !== undefined) updates.quantityUnit = body.quantityUnit;
  if (body.reminderEnabled !== undefined) updates.reminderEnabled = body.reminderEnabled;
  if (body.notes !== undefined) updates.notes = body.notes;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [supp] = await db
    .update(supplementsTable)
    .set(updates)
    .where(and(eq(supplementsTable.id, id), eq(supplementsTable.userId, req.auth!.userId)))
    .returning();

  if (!supp) { res.status(404).json({ error: "Supplement not found" }); return; }

  res.json(serializeSupplement(supp));
});

router.delete("/supplements/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [deleted] = await db
    .delete(supplementsTable)
    .where(and(eq(supplementsTable.id, id), eq(supplementsTable.userId, req.auth!.userId)))
    .returning({ id: supplementsTable.id });

  if (!deleted) { res.status(404).json({ error: "Supplement not found" }); return; }

  res.status(204).end();
});

export default router;
