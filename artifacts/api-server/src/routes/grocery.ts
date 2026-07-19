import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, groceryListsTable, groceryListItemsTable } from "@workspace/db";
import {
  ListGroceryListsResponse,
  GetGroceryListResponse,
  CreateGroceryListBody,
  CreateGroceryListResponse,
  UpdateGroceryListBody,
  UpdateGroceryListResponse,
  AddGroceryListItemBody,
  AddGroceryListItemResponse,
  UpdateGroceryListItemBody,
  UpdateGroceryListItemResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function serializeList(list: typeof groceryListsTable.$inferSelect) {
  return {
    id: list.id,
    userId: list.userId,
    name: list.name,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
  };
}

function serializeItem(item: typeof groceryListItemsTable.$inferSelect) {
  return {
    id: item.id,
    listId: item.listId,
    name: item.name,
    quantity: item.quantity !== null ? Number(item.quantity) : null,
    unit: item.unit ?? null,
    checked: item.checked,
    notes: item.notes ?? null,
  };
}

router.get("/grocery-lists", requireAuth, async (req, res): Promise<void> => {
  const lists = await db
    .select()
    .from(groceryListsTable)
    .where(eq(groceryListsTable.userId, req.auth!.userId))
    .orderBy(groceryListsTable.createdAt);

  res.json(ListGroceryListsResponse.parse(lists.map(serializeList)));
});

router.post("/grocery-lists", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateGroceryListBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [list] = await db
    .insert(groceryListsTable)
    .values({ userId: req.auth!.userId, name: (parsed.data as { name: string }).name })
    .returning();

  res.status(201).json(CreateGroceryListResponse.parse(serializeList(list)));
});

router.get("/grocery-lists/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [list] = await db
    .select()
    .from(groceryListsTable)
    .where(and(eq(groceryListsTable.id, id), eq(groceryListsTable.userId, req.auth!.userId)));

  if (!list) {
    res.status(404).json({ error: "Grocery list not found" });
    return;
  }

  const items = await db
    .select()
    .from(groceryListItemsTable)
    .where(eq(groceryListItemsTable.listId, id))
    .orderBy(groceryListItemsTable.id);

  res.json(
    GetGroceryListResponse.parse({
      ...serializeList(list),
      items: items.map(serializeItem),
    }),
  );
});

router.patch("/grocery-lists/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdateGroceryListBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  if (data.name !== undefined) updates.name = data.name;

  const [list] = await db
    .update(groceryListsTable)
    .set(updates)
    .where(and(eq(groceryListsTable.id, id), eq(groceryListsTable.userId, req.auth!.userId)))
    .returning();

  if (!list) {
    res.status(404).json({ error: "Grocery list not found" });
    return;
  }

  res.json(UpdateGroceryListResponse.parse(serializeList(list)));
});

router.delete("/grocery-lists/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [list] = await db
    .delete(groceryListsTable)
    .where(and(eq(groceryListsTable.id, id), eq(groceryListsTable.userId, req.auth!.userId)))
    .returning({ id: groceryListsTable.id });

  if (!list) {
    res.status(404).json({ error: "Grocery list not found" });
    return;
  }

  res.sendStatus(204);
});

router.post(
  "/grocery-lists/:listId/items",
  requireAuth,
  async (req, res): Promise<void> => {
    const rawListId = Array.isArray(req.params.listId)
      ? req.params.listId[0]
      : req.params.listId;
    const listId = parseInt(rawListId, 10);
    if (isNaN(listId)) {
      res.status(400).json({ error: "Invalid list id" });
      return;
    }

    const [list] = await db
      .select({ id: groceryListsTable.id })
      .from(groceryListsTable)
      .where(
        and(
          eq(groceryListsTable.id, listId),
          eq(groceryListsTable.userId, req.auth!.userId),
        ),
      );

    if (!list) {
      res.status(404).json({ error: "Grocery list not found" });
      return;
    }

    const parsed = AddGroceryListItemBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const data = parsed.data as Record<string, unknown>;

    const [item] = await db
      .insert(groceryListItemsTable)
      .values({
        listId,
        name: data.name as string,
        quantity: data.quantity !== undefined ? String(data.quantity) : null,
        unit: (data.unit as string) ?? null,
        notes: (data.notes as string) ?? null,
        checked: false,
      })
      .returning();

    res.status(201).json(AddGroceryListItemResponse.parse(serializeItem(item)));
  },
);

router.patch(
  "/grocery-lists/:listId/items/:itemId",
  requireAuth,
  async (req, res): Promise<void> => {
    const rawListId = Array.isArray(req.params.listId)
      ? req.params.listId[0]
      : req.params.listId;
    const rawItemId = Array.isArray(req.params.itemId)
      ? req.params.itemId[0]
      : req.params.itemId;
    const listId = parseInt(rawListId, 10);
    const itemId = parseInt(rawItemId, 10);

    if (isNaN(listId) || isNaN(itemId)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const [list] = await db
      .select({ id: groceryListsTable.id })
      .from(groceryListsTable)
      .where(
        and(
          eq(groceryListsTable.id, listId),
          eq(groceryListsTable.userId, req.auth!.userId),
        ),
      );

    if (!list) {
      res.status(404).json({ error: "Grocery list not found" });
      return;
    }

    const parsed = UpdateGroceryListItemBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const data = parsed.data as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.quantity !== undefined) updates.quantity = String(data.quantity);
    if (data.unit !== undefined) updates.unit = data.unit;
    if (data.checked !== undefined) updates.checked = data.checked;
    if (data.notes !== undefined) updates.notes = data.notes;

    const [item] = await db
      .update(groceryListItemsTable)
      .set(updates)
      .where(
        and(
          eq(groceryListItemsTable.id, itemId),
          eq(groceryListItemsTable.listId, listId),
        ),
      )
      .returning();

    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    res.json(UpdateGroceryListItemResponse.parse(serializeItem(item)));
  },
);

router.delete(
  "/grocery-lists/:listId/items/:itemId",
  requireAuth,
  async (req, res): Promise<void> => {
    const rawListId = Array.isArray(req.params.listId)
      ? req.params.listId[0]
      : req.params.listId;
    const rawItemId = Array.isArray(req.params.itemId)
      ? req.params.itemId[0]
      : req.params.itemId;
    const listId = parseInt(rawListId, 10);
    const itemId = parseInt(rawItemId, 10);

    if (isNaN(listId) || isNaN(itemId)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const [list] = await db
      .select({ id: groceryListsTable.id })
      .from(groceryListsTable)
      .where(
        and(
          eq(groceryListsTable.id, listId),
          eq(groceryListsTable.userId, req.auth!.userId),
        ),
      );

    if (!list) {
      res.status(404).json({ error: "Grocery list not found" });
      return;
    }

    const [item] = await db
      .delete(groceryListItemsTable)
      .where(
        and(
          eq(groceryListItemsTable.id, itemId),
          eq(groceryListItemsTable.listId, listId),
        ),
      )
      .returning({ id: groceryListItemsTable.id });

    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    res.sendStatus(204);
  },
);

export default router;
