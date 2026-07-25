import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, groceryListsTable, groceryListItemsTable, mealPlansTable, mealPlanMealsTable, mealPlanIngredientsTable, inventoryTable } from "@workspace/db";
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
    currentQty: item.currentQty !== null ? Number(item.currentQty) : null,
    requiredQty: item.requiredQty !== null ? Number(item.requiredQty) : null,
    toBuyQty: item.toBuyQty !== null ? Number(item.toBuyQty) : null,
    reason: item.reason ?? null,
    category: item.category ?? null,
    aiGenerated: item.aiGenerated,
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

// ── Smart Grocery Optimization ────────────────────────────────────────────────

router.post("/grocery-lists/:id/optimize", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const userId = req.auth!.userId;

  // Verify list ownership
  const [list] = await db
    .select()
    .from(groceryListsTable)
    .where(and(eq(groceryListsTable.id, id), eq(groceryListsTable.userId, userId)));
  if (!list) { res.status(404).json({ error: "Grocery list not found" }); return; }

  // Get meal plans for the next 7 days
  const today = new Date();
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }

  const mealPlans = await db
    .select()
    .from(mealPlansTable)
    .where(and(
      eq(mealPlansTable.userId, userId),
      sql`${mealPlansTable.date} = ANY(${sql.raw(`ARRAY['${dates.join("','")}']::date[]`)})`
    ));

  // Aggregate all ingredients needed
  const ingredientTotals = new Map<string, { quantityG: number; category?: string; meals: string[] }>();

  for (const plan of mealPlans) {
    const planMeals = await db
      .select()
      .from(mealPlanMealsTable)
      .where(and(eq(mealPlanMealsTable.planId, plan.id), eq(mealPlanMealsTable.completed, false)));

    const mealIds = planMeals.map((m) => m.id);
    if (mealIds.length === 0) continue;

    const ingredients = await db
      .select()
      .from(mealPlanIngredientsTable)
      .where(sql`${mealPlanIngredientsTable.mealId} = ANY(${sql.raw(`ARRAY[${mealIds.join(",")}]`)})`);

    for (const ing of ingredients) {
      const key = ing.name.toLowerCase();
      const mealName = planMeals.find((m) => m.id === ing.mealId)?.name ?? "";
      const existing = ingredientTotals.get(key);
      if (existing) {
        existing.quantityG += Number(ing.quantityG);
        if (!existing.meals.includes(mealName)) existing.meals.push(mealName);
      } else {
        ingredientTotals.set(key, {
          quantityG: Number(ing.quantityG),
          meals: mealName ? [mealName] : [],
        });
      }
    }
  }

  // Get current inventory
  const inventory = await db
    .select()
    .from(inventoryTable)
    .where(eq(inventoryTable.userId, userId));

  const inventoryMap = new Map<string, { qty: number; unit: string; id: number; category: string | null }>();
  for (const item of inventory) {
    inventoryMap.set(item.name.toLowerCase(), {
      qty: Number(item.quantity),
      unit: item.unit,
      id: item.id,
      category: item.category,
    });
  }

  // Clear old AI-generated items
  await db
    .delete(groceryListItemsTable)
    .where(and(eq(groceryListItemsTable.listId, id), eq(groceryListItemsTable.aiGenerated, true)));

  // Insert smart items for ingredients that need to be bought
  const newItems: (typeof groceryListItemsTable.$inferSelect)[] = [];
  for (const [key, needed] of ingredientTotals.entries()) {
    const inv = inventoryMap.get(key);
    const currentQty = inv?.qty ?? 0;
    const toBuy = Math.max(0, needed.quantityG - currentQty);

    if (toBuy <= 0) continue; // Already have enough

    const mealCount = needed.meals.length;
    const reason =
      mealCount === 1
        ? `Needed for: ${needed.meals[0]}`
        : `Needed for ${mealCount} meals this week`;

    // Capitalize ingredient name
    const displayName = key.charAt(0).toUpperCase() + key.slice(1);

    const [item] = await db
      .insert(groceryListItemsTable)
      .values({
        listId: id,
        name: displayName,
        quantity: String(Math.ceil(toBuy)),
        unit: inv?.unit ?? "g",
        checked: false,
        currentQty: String(currentQty),
        requiredQty: String(needed.quantityG),
        toBuyQty: String(toBuy),
        reason,
        category: inv?.category ?? null,
        aiGenerated: true,
      })
      .returning();

    newItems.push(item);
  }

  // Return updated list with all items
  const allItems = await db
    .select()
    .from(groceryListItemsTable)
    .where(eq(groceryListItemsTable.listId, id))
    .orderBy(groceryListItemsTable.id);

  res.json({
    ...serializeList(list),
    items: allItems.map(serializeItem),
  });
});

export default router;
