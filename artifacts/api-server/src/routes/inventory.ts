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
    quantity: Number(item.quantity),
    unit: item.unit,
    expiryDate: item.expiryDate ?? null,
    notes: item.notes ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
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

  const [item] = await db
    .insert(inventoryTable)
    .values({
      userId: req.auth!.userId,
      foodId: (data.foodId as number) ?? null,
      name: data.name as string,
      quantity: String(data.quantity),
      unit: data.unit as string,
      expiryDate: (data.expiryDate as string) ?? null,
      notes: (data.notes as string) ?? null,
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
  const updates: Record<string, unknown> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.quantity !== undefined) updates.quantity = String(data.quantity);
  if (data.unit !== undefined) updates.unit = data.unit;
  if (data.expiryDate !== undefined) updates.expiryDate = data.expiryDate;
  if (data.notes !== undefined) updates.notes = data.notes;

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
