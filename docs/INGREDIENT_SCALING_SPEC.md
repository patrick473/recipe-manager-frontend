# Ingredient Scaling

Spec for [FUTURE_IDEAS.md](FUTURE_IDEAS.md) item 8: let users scale
ingredient quantities on the recipe detail page.

This spec picks **parsing the existing Markdown `content`** at display time
over building a structured `Ingredient`/`Quantity`/`Unit` entity — that's
item 12 ("Structured ingredients & steps"), filed separately as a "Bigger
investment" while item 8 is a "Medium feature." A real data model would mean
a backend migration, new DTOs, an `openapi.yaml`/client regen, and a
`RecipeFormComponent` content-editing rewrite for a feature whose payoff is
just "the numbers on the ingredient list change." Regex-parsing quantities
already in `content` gets the same outcome as a frontend-only, display-time
transform: no backend change, nothing new to persist. The tradeoff: it's a
heuristic over freeform text with real gaps (below), inherent to parsing
prose rather than structured data — item 12 is the fix if those gaps ever
bite.

**Explicitly out of scope:**

- Backend/`openapi.yaml` changes, persistence of a chosen scale factor —
  view-only state that resets on navigation/reload
- Unit conversion (`3 tbsp` → `3/16 cup`) — only the leading number is
  rewritten, unit text untouched
- Scaling quantity ranges (`2-3 cloves`) — recognized as unscalable, left
  as-is
- Quantities that aren't the first token on the line (`Juice of 2 lemons`) —
  known heuristic gap
- Unicode vulgar fractions (½, ¼) — not present in mock-recipes.json today,
  not parsed
- Rounding scaled discrete-item counts to whole numbers (`3 eggs` × 1.5 →
  `4.5 eggs` not `5`) — no reliable way to know discrete vs. continuous from
  plain text
- Editing stored `content`/`servings` from the scale control — read-only
  display transform on `RecipeDetailComponent` only
- Shopping-list export of scaled quantities — `FUTURE_IDEAS.md` item 14,
  separate feature

## Shape of the change

New pure utility `shared/ingredient-scaling.util.ts` (mirrors the existing
`recipe-time.util.ts` / `image-url.util.ts` pattern):

- `hasScalableIngredients()`, `scaleIngredientsMarkdown()`, plus the
  unit-testable halves `parseQuantityToken()` and `formatScaledQuantity()`.
- Only touches bullet lines inside the `## Ingredients` section, found by
  scanning ATX headings for one matching `/ingredients/i` up to the next
  heading — keeps numbered `## Instructions` steps (which also start with
  digits) safe. Non-quantity lines (`salt to taste`) pass through unchanged.
- Scaled output matches the original line's convention: fraction/mixed-number
  tokens round to the nearest eighth and render as plain-ASCII mixed numbers
  (never unicode, never improper); plain integers/decimals (including
  glued-unit forms like `400g`) render as decimals trimmed to at most 2
  places. A result that rounds to exactly 0 is clamped to the smallest
  representable unit rather than showing `0 egg`.
- If there's no `## Ingredients` heading or no bulleted quantity lines, the
  parser returns `content` unchanged — `hasScalableIngredients()` uses this
  to decide whether `RecipeDetailComponent` shows the scale control at all.

Scale control on the recipe detail page:

- Two presentations depending on whether the recipe has a stored `servings`
  value: a servings stepper (factor = target/servings) when set, a segmented
  multiplier (`0.5× 1× 1.5× 2× 3×`) when `servings` is null and there's no
  ratio to compute against.
- `renderedContent` changes from a plain signal set once in `ngOnInit` to a
  `computed()` over `recipe` and a new `scaleFactor` signal, feeding
  `scaleIngredientsMarkdown()` before `marked.parse()`. Resets to default
  every time a different recipe loads.
- Placed between the properties panel and the divider, above the Markdown
  body, so it reads as "adjust before you look at ingredients."

## Testing

`ingredient-scaling.util.spec.ts` covers the parsing/formatting heuristics
directly: token parsing across integer/decimal/fraction/mixed/glued-unit/
non-numeric forms, fraction vs. decimal formatting including the zero-clamp
case, and full-markdown scaling (Instructions untouched, no-heading
passthrough, factor-of-1 identity modulo eighth-rounding).
`recipe-detail.component.spec.ts` covers control visibility, stepper-vs-
multiplier selection, live re-render on change, and reset on recipe
navigation.

## Deferred

- Structured `Ingredient`/`Quantity`/`Unit` entities (`FUTURE_IDEAS.md` item 12) — fixes every heuristic gap above, at the cost of a backend migration
  and content-editing UI rewrite
- Remembering the last-used scale factor per recipe (e.g. `localStorage`,
  mirroring item 9's favorites pattern) — deliberately left as reset-on-load
  state
- Unit-aware rounding of discrete-item counts instead of showing `4.5 eggs`
- Feeding scaled quantities into a shopping-list export (item 14) — would
  consume this pass's parsing logic but building the list itself is out of
  scope
