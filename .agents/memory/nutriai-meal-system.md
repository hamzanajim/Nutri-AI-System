---
name: NutriAI Meal System
description: Architecture decisions and gotchas for the meal planning + logging system.
---

## Ingredient availability matching
- `(eq as any)(inventoryTable.name, ing.name)` was case-sensitive — replaced with normalised string comparison in `matchIngredientToInventory()`.
- Matching priority: explicit `inventoryItemId` from AI → normalised exact name → fuzzy partial/singular-plural.
- AI prompt now includes `ID:{n}` prefix on every inventory line so the model can include the ID in its JSON (`"inventoryItemId": 42`) and skip name-matching entirely.

**Why:** Name-based matching was the root cause of false "missing ingredient" alerts.

## AI prompt rules enforced
- One primary protein per meal (never chicken+salmon in one meal).
- Different protein across all meals in the day (breakfast eggs → lunch chicken).
- Meal structure: Protein + Carb + Veg + optional Fat + Seasoning.
- Natural meal names baked into the system prompt with examples.
- `regenerateSingleMeal` fetches sibling meals from DB and passes them to the prompt to prevent repetition.

## Ingredient PATCH endpoint
- `PATCH /meal-plans/:id/meals/:mealId/ingredients/:ingId` added to `meal-plans.ts`.
- Not in OpenAPI spec / codegen — called directly via `fetch` in `meals.tsx` using `token` from `useAuth()` and `process.env.EXPO_PUBLIC_DOMAIN`.

**Why:** Avoided codegen round-trip for a single narrow endpoint.

## meals.tsx UX model
- `expandedPlan: number | null` — which AI plan meal is expanded (separate from `expandedMeal` for logged meals).
- Expanded card shows: ingredient list with green/red dot + "missing" tag, macro chips, cooking time, action row (Prep | Replace | Delete | Log Meal).
- "Log Meal" (not a bare checkmark) triggers `completeMealPlanMeal` which deducts inventory + creates log entry + invalidates plan/meals/dashboard queries.
- Missing Ingredients section: per-ingredient "Add to Grocery" (via `useListGroceryLists` + `useCreateGroceryList` + `useAddGroceryListItem`) and "Replace Ingredient" (via `useReplaceMealIngredient` + ingredient PATCH).
- `addedToGrocery: Set<number>` tracks which ingredient IDs were added this session for visual feedback.

## Base URL for direct fetch calls
`https://${process.env.EXPO_PUBLIC_DOMAIN}` — set in `artifacts/mobile/app/_layout.tsx` via `setBaseUrl`.
