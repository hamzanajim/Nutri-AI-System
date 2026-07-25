---
name: NutriAI Meal System
description: Durable decisions and constraints for the meal planning + logging system.
---

## Ingredient matching must prefer inventory ID over name

AI prompt includes `ID:{n}` prefix on every inventory line so the model can output `"inventoryItemId": 42` in its JSON. Matching priority in `matchIngredientToInventory()`: explicit ID → normalised exact name → fuzzy partial/singular-plural. Name-only matching was the root cause of false "missing ingredient" alerts.

**Why:** Case-sensitive DB equality was producing false negatives even when the user had the item in their pantry.

## One plan per (userId, date) enforced at DB + application level

A unique index on `meal_plans(user_id, date)` is the authoritative guard. Application code (AI generate + manual POST) must also delete-or-check before inserting to avoid relying solely on DB error handling.

**Why:** Without the constraint, rapid re-generate or concurrent requests created multiple plans for the same day. The client picks `plans?.[0]` so the "active" plan was non-deterministic without `createdAt DESC` ordering.

## IDOR guard on ingredient PATCH

`PATCH /meal-plans/:id/meals/:mealId/ingredients/:ingId` must verify:
1. Plan belongs to authenticated user.
2. Meal belongs to that plan.
3. Only then update ingredient by `(ingId, mealId)`.

Skipping step 2 would let any user patch another user's ingredient by guessing IDs.

## Completion endpoint must be fully transactional

Inventory deduction, meal mark-complete, and nutrition log creation must all run inside a single `db.transaction()`. A partial failure (e.g. log insert fails) previously left inventory decremented with no completion record.

## meals.tsx expand/log state model

`expandedPlanMealId` (not a boolean) tracks which AI plan meal is expanded. `loggedMealId` drives a 1.5 s "Logged ✓" inline state before the card collapses. Both must be cleared on delete/regenerate success to avoid showing a stale expanded card.
