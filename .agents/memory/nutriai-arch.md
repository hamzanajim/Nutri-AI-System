---
name: NutriAI Architecture
description: Key decisions and gotchas for the NutriAI full-stack nutrition app.
---

## Stack
- Expo mobile app at `artifacts/mobile/`
- Express 5 API at `artifacts/api-server/`
- PostgreSQL + Drizzle ORM at `lib/db/`
- OpenAPI-first codegen: `lib/api-spec/openapi.yaml` → `@workspace/api-client-react` + `@workspace/api-zod`

## Critical build sequence (must follow this order)
1. Edit `lib/db/src/schema/` files
2. `pnpm --filter @workspace/db run push` — pushes schema to Postgres
3. `pnpm --filter @workspace/api-spec run codegen` — regenerates zod + react-query
4. `pnpm --filter @workspace/db run build` — emits .d.ts files needed by api-server TS
5. Typecheck both packages
6. Restart both workflows

Steps 2 and 3 are independent and can run in parallel.
`lib/db/package.json` has `"build": "tsc -p tsconfig.json"` — added manually.

## Auth
- JWT Bearer tokens (mobile-appropriate). `SESSION_SECRET` env var for signing.
- `bcryptjs` (pure JS, no native deps — Expo Go compatible).
- Token stored in AsyncStorage via `context/AuthContext.tsx`; `setAuthTokenGetter` wired so every API call gets auth.

## Tab layout (5 tabs)
Dashboard | Meals | Inventory | Grocery | Profile
AI tab is still a route but has `href: null` (hidden from tab bar).
6 tabs is too many — keep 5 max.

## Onboarding flow
After register → `/(auth)/onboarding` (5-step profile wizard) → `/(onboarding)/inventory-setup` (7-category wizard) → `/(tabs)/inventory`
Inventory tab is always accessible from bottom nav after onboarding.

## Inventory system
DB table `inventory` fields: id, userId, foodId, name, category, quantity, unit, storageLocation, expiryDate (→ API expirationDate), caloriesPer100g, proteinPer100g, carbsPer100g, fatPer100g, notes.
Category enum: protein | carbs | vegetables | fruits | dairy | fats | pantry | drinks | supplements
Storage enum: fridge | freezer | pantry
API field mapping: DB `expiryDate` → API `expirationDate` (rename in serializer only, no column rename).

## Food autocomplete + nutrition suggestion
- `GET /foods?q=` combines static built-in nutrition DB (`artifacts/api-server/src/data/nutritionDatabase.ts`, ~90 foods) with user's custom foods from DB.
- `POST /foods/suggest-nutrition` returns nutrition data for a food name from built-in DB.
- Schema collision rule: operationId `suggestNutrition` auto-generates `SuggestNutritionResponse` — do NOT name a component schema `SuggestNutritionResponse`. Named it `NutritionSuggestion` in spec instead.

## Profile model — full field list
DB: name, age, gender, heightCm, weightKg, goalWeight, fitnessGoal, activityLevel,
    workoutFrequency, workoutTypes[], mealFrequency, shoppingFrequency,
    dietPreferences[], favoriteFoods[], foodsToAvoid[],
    allergies[], foodIntolerances[], digestiveIssues[], healthConditions[]
API enums: fitnessGoal=[lose_fat|maintain|gain_muscle|improve_health],
           shoppingFrequency=[weekly|biweekly|monthly|custom]

## Codegen quirks
- `format: email` must NOT be used in openapi.yaml (Zod v4 syntax not available in generated code).
- Orval generates `<OperationId>Response` and `<OperationId>Body` Zod schemas from operationIds. Naming a component schema with the same name causes TS2308 duplicate export. Rename the component schema to avoid conflicts.
- `useSearchFoods` (and any query hook) second-argument `query` option requires `queryKey` in React Query v5. Always pass `queryKey: getSearchFoodsQueryKey(params)` alongside `enabled`.

## Color system
- `artifacts/mobile/constants/colors.ts` exports `{ light, dark, radius }`.
- `artifacts/mobile/hooks/useColors.ts` — must type `palette` as `typeof colors.light` explicitly.

## AI routes
- Stubbed at `artifacts/api-server/src/routes/ai.ts` — ready for OpenAI/Anthropic key.
- `findLast` unavailable (ES2022 target) — use `[...arr].reverse().find(...)`.

## Nutrition targets (Mifflin-St Jeor)
- Computed server-side in `artifacts/api-server/src/routes/nutrition.ts`.
- Activity multipliers and goal calorie adjustments are hardcoded maps.
