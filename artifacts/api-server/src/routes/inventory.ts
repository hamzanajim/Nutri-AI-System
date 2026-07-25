import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, inventoryTable } from "@workspace/db";
import {
  ListInventoryResponse,
  GetInventoryItemResponse,
  CreateInventoryItemBody,
  CreateInventoryItemResponse,
  UpdateInventoryItemBody,
  UpdateInventoryItemResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function serializeItem(item: typeof inventoryTable.$inferSelect) {
  return {
    id: item.id,
    userId: item.userId,
    foodId: item.foodId ?? null,
    name: item.name,
    category: item.category ?? null,
    quantity: Number(item.quantity),
    unit: item.unit,
    storageLocation: item.storageLocation ?? null,
    expirationDate: item.expiryDate ?? null, // DB column expiryDate → API field expirationDate
    caloriesPer100g: item.caloriesPer100g !== null && item.caloriesPer100g !== undefined ? Number(item.caloriesPer100g) : null,
    proteinPer100g: item.proteinPer100g !== null && item.proteinPer100g !== undefined ? Number(item.proteinPer100g) : null,
    carbsPer100g: item.carbsPer100g !== null && item.carbsPer100g !== undefined ? Number(item.carbsPer100g) : null,
    fatPer100g: item.fatPer100g !== null && item.fatPer100g !== undefined ? Number(item.fatPer100g) : null,
    notes: item.notes ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function extractValues(data: Record<string, unknown>) {
  const v: Record<string, unknown> = {};
  if (data.name !== undefined) v.name = data.name;
  if (data.category !== undefined) v.category = data.category;
  if (data.quantity !== undefined) v.quantity = String(data.quantity);
  if (data.unit !== undefined) v.unit = data.unit;
  if (data.storageLocation !== undefined) v.storageLocation = data.storageLocation;
  // API uses expirationDate, DB uses expiryDate
  if (data.expirationDate !== undefined) v.expiryDate = data.expirationDate;
  if (data.caloriesPer100g !== undefined) v.caloriesPer100g = data.caloriesPer100g !== null ? String(data.caloriesPer100g) : null;
  if (data.proteinPer100g !== undefined) v.proteinPer100g = data.proteinPer100g !== null ? String(data.proteinPer100g) : null;
  if (data.carbsPer100g !== undefined) v.carbsPer100g = data.carbsPer100g !== null ? String(data.carbsPer100g) : null;
  if (data.fatPer100g !== undefined) v.fatPer100g = data.fatPer100g !== null ? String(data.fatPer100g) : null;
  if (data.notes !== undefined) v.notes = data.notes;
  return v;
}

router.get("/inventory", requireAuth, async (req, res): Promise<void> => {
  const items = await db
    .select()
    .from(inventoryTable)
    .where(eq(inventoryTable.userId, req.auth!.userId))
    .orderBy(inventoryTable.name);

  res.json(ListInventoryResponse.parse(items.map(serializeItem)));
});

router.post("/inventory", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateInventoryItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data as Record<string, unknown>;
  const values = extractValues(data);

  const [item] = await db
    .insert(inventoryTable)
    .values({
      userId: req.auth!.userId,
      name: values.name as string,
      quantity: values.quantity as string,
      unit: values.unit as string,
      ...values,
    })
    .returning();

  res.status(201).json(CreateInventoryItemResponse.parse(serializeItem(item)));
});

router.get("/inventory/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [item] = await db
    .select()
    .from(inventoryTable)
    .where(and(eq(inventoryTable.id, id), eq(inventoryTable.userId, req.auth!.userId)));

  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  res.json(GetInventoryItemResponse.parse(serializeItem(item)));
});

router.patch("/inventory/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdateInventoryItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data as Record<string, unknown>;
  const updates = extractValues(data);

  const [item] = await db
    .update(inventoryTable)
    .set(updates)
    .where(and(eq(inventoryTable.id, id), eq(inventoryTable.userId, req.auth!.userId)))
    .returning();

  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  res.json(UpdateInventoryItemResponse.parse(serializeItem(item)));
});

router.delete("/inventory/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [item] = await db
    .delete(inventoryTable)
    .where(and(eq(inventoryTable.id, id), eq(inventoryTable.userId, req.auth!.userId)))
    .returning({ id: inventoryTable.id });

  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
