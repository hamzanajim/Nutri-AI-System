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

## Onboarding flow (5-step wizard)
After register → `/(auth)/onboarding` (5 steps) → `/(onboarding)/inventory-setup` → `/(tabs)`
Steps: 1=Personal Info, 2=Goals, 3=Activity, 4=Health Profile, 5=Food Preferences.
"Skip setup for now" on step 1 routes directly to `/(tabs)`.
Root _layout.tsx must include `(onboarding)` in its Stack alongside `(auth)` and `(tabs)`.

## Profile model — full field list
DB: name, age, gender, heightCm, weightKg, goalWeight, fitnessGoal, activityLevel,
    workoutFrequency, workoutTypes[], mealFrequency, shoppingFrequency,
    dietPreferences[], favoriteFoods[], foodsToAvoid[],
    allergies[], foodIntolerances[], digestiveIssues[], healthConditions[]
API enums: fitnessGoal=[lose_fat|maintain|gain_muscle|improve_health],
           shoppingFrequency=[weekly|biweekly|monthly|custom]
(Note: old enum had lose_weight/improve_endurance — replaced with lose_fat/improve_health)

## Color system
- `artifacts/mobile/constants/colors.ts` exports `{ light, dark, radius }`.
- `artifacts/mobile/hooks/useColors.ts` — must type `palette` as `typeof colors.light` explicitly.

## Codegen quirks
- `format: email` must NOT be used in openapi.yaml (Zod v4 syntax not available in generated code).
- Component schema `NutritionChatResponse` renamed to `ChatReply` (avoids Orval TS2308 collision).

## AI routes
- Stubbed at `artifacts/api-server/src/routes/ai.ts` — ready for OpenAI/Anthropic key.
- `findLast` unavailable (ES2022 target) — use `[...arr].reverse().find(...)`.

## Nutrition targets (Mifflin-St Jeor)
- Computed server-side in `artifacts/api-server/src/routes/nutrition.ts`.
- Activity multipliers and goal calorie adjustments are hardcoded maps.
