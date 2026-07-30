# Ingredient Scaling

Design spec for [FUTURE_IDEAS.md](FUTURE_IDEAS.md) item 8: "parse quantities
out of the Markdown `content` (or model ingredients as structured data
instead of freeform Markdown) so servings can be scaled up/down." This spec
picks **parsing the existing Markdown**, not a structured `Ingredient`
entity — that's item 12 ("Structured ingredients & steps"), explicitly
called out as one of the "Bigger investments," and item 8 is filed as a
"Medium feature." Building a real `Ingredient`/`Quantity`/`Unit` data model
means a backend migration, new DTOs, an `openapi.yaml`/client regen, and a
rewrite of `RecipeFormComponent`'s content editing — a lot of surface area
for a feature whose actual payoff is "the numbers on the ingredient list
change." Regex-parsing the quantities already sitting in `content` gets the
same user-facing outcome as a frontend-only, display-time transform: no
backend change, no migration, nothing new to persist.

The tradeoff that buys: it's a heuristic over freeform text, so it has real
gaps (see "Explicitly out of scope" below). Those gaps are inherent to
parsing prose rather than structured data, not bugs to chase down — item 12
is the actual fix if they ever become painful enough to matter.

**Explicitly out of scope for this pass:**

- Any backend or `openapi.yaml` change. No new fields, no persistence of a
  chosen scale factor — it's view-only state on the detail page that resets
  on navigation/reload.
- Unit conversion (e.g. turning `3 tbsp` into `3/16 cup` when scaled). Only
  the leading number is ever rewritten; the unit text is untouched.
- Scaling quantity ranges (`2-3 cloves garlic`) — recognized as
  unscalable and left as-is rather than guessing which end to scale.
- Quantities that aren't the first token on the line (`Juice of 2 lemons`,
  `zest of 1 orange`) — a known heuristic gap; parsing only looks at the
  start of each ingredient line.
- Unicode vulgar fractions (`½`, `¼`) — not present anywhere in
  [mock-recipes.json](../../recipe-manager-backend/src/main/resources/data/mock-recipes.json)
  today (see baseline below), so not parsed. Add them to the regex/format
  tables in Part 1 if real content ever uses them.
- Rounding scaled counts of discrete items to whole numbers (`3 eggs` × 1.5
  renders as `4.5 eggs`, not `5`) — there's no reliable way to know which
  ingredients are discrete vs. continuous from plain text; flagged as a
  known limitation rather than solved with a guess.
- Editing the recipe's stored `content` or `servings` from the scale
  control. This is a read-only display transform on
  `RecipeDetailComponent`; `RecipeFormComponent` and the stored Markdown are
  never touched.
- A shopping-list export of scaled quantities — that's `FUTURE_IDEAS.md`
  item 14 (meal planning / shopping list), a separate feature that would
  consume this one's parsing logic but isn't part of this spec.

---

## Current state (baseline)

- `Recipe` ([Recipe.java](../../recipe-manager-backend/src/main/java/com/example/recipemanager/model/Recipe.java)):
  `content` is a single `@Column(columnDefinition = "TEXT")` Markdown blob
  (line 43-46, comment "Full recipe body in Markdown format"); `servings` is
  a nullable `Integer` with no entity-level constraint (line 70).
  `RecipeRequest` validates it with `@Min(0)` on create/update
  ([RecipeRequest.java](../../recipe-manager-backend/src/main/java/com/example/recipemanager/dto/RecipeRequest.java)
  line 49-51). No `Ingredient` entity or field exists anywhere in the
  backend — ingredients live only as text inside `content`.
- **Markdown convention**, confirmed across all 20 recipes in
  [mock-recipes.json](../../recipe-manager-backend/src/main/resources/data/mock-recipes.json):
  an `## Ingredients` heading followed by a blank line and a `- `-bulleted
  list, one ingredient per line, then an `## Instructions` heading with a
  numbered list. Quantity formats actually in use: plain integers (`3 large
  eggs`), decimals is absent but would read the same way, simple fractions
  (`1/2 cup crushed San Marzano tomatoes`), mixed numbers (`1 1/2 cups
  all-purpose flour`), and numbers glued directly to a metric unit with no
  space (`400g spaghetti`, `1kg ripe tomatoes`). A meaningful chunk of lines
  have **no** leading quantity at all (`salt to taste`, `pinch of salt`,
  `fresh basil leaves`, `condiments to taste`) — those need to be left
  alone, not misparsed.
- `RecipeDetailComponent` ([recipe-detail.component.ts](../src/app/components/recipe-detail/recipe-detail.component.ts)):
  `ngOnInit`'s subscribe (line ~72-81) calls `marked.parse(data.content)`
  once, wraps it with `sanitizer.bypassSecurityTrustHtml()`, and sets the
  result into a plain `renderedContent` signal — it's computed once at load
  time, not reactively derived from `content` today.
- `recipe-detail.component.html`: `<app-properties-panel [editable]="false"
  ... [servings]="r.servings ?? null" />` displays the recipe's stored
  servings count read-only; the Markdown body renders separately via
  `[innerHTML]="renderedContent()"`. `PropertiesPanelComponent`
  ([properties-panel.component.ts](../src/app/shared/properties-panel/properties-panel.component.ts))
  has no notion of scaling — its `servings` input is a plain display value
  in read-only mode.
- No quantity-parsing or scaling logic exists anywhere in the frontend
  today.

---

## Part 1 — Parsing and rewriting ingredient quantities

### Behavior

- Only lines inside the `## Ingredients` section are ever touched. Section
  boundaries are found by scanning ATX headings (`^#{1,6}\s+...`): the
  section starts at the first heading whose text matches `/ingredients/i`
  and ends at the next heading of any level (or end of content). This keeps
  numbered `## Instructions` steps — which also start with digits — from
  ever being misread as quantities.
- Within that section, only bullet-list lines (`^[-*]\s+`) are candidates.
  For each one, the **leading token** is tested against a quantity pattern:
  an integer, a decimal, a simple fraction (`1/2`), or a mixed number (`1
  1/2`), optionally glued directly to a unit with no space (`400g`, `1kg`).
  A line whose first token doesn't match — `salt to taste`, `pinch of
  salt`, `fresh basil leaves` — is passed through unchanged. Everything
  after the matched quantity (unit, descriptors, ingredient name) is also
  passed through unchanged; only the quantity token itself is replaced.
- **Formatting the scaled result** follows the convention the original line
  already used, so scaled output still looks hand-written:
  - If the original token contained a `/` (a fraction or mixed number),
    the scaled value is rounded to the nearest eighth and rendered as a
    plain-ASCII mixed number (`1 1/2`, `2 3/4`), matching the existing
    seed-data style — never a unicode fraction glyph, never an improper
    fraction like `3/2`.
  - Otherwise (a plain integer or decimal, including the glued-unit case
    like `400g`), the scaled value is rendered as a decimal rounded to at
    most 2 places with trailing zeros trimmed (`600`, `3.5`, not `600.00`).
  - A scaled value of exactly `0` (e.g. scaling `1 egg` down to a factor
    that rounds to zero) is clamped to the smallest representable unit for
    that format (`1/8` for fraction-style, `0.01` for decimal-style) rather
    than emitting `0 egg`, which would read as "omit this ingredient."
- If a recipe has no `## Ingredients` heading, or the section has no
  bullet lines with a leading quantity, the parser returns `content`
  completely unchanged and reports "nothing scalable" — this is what Part
  2 uses to decide whether to show the scale control at all.

### Implementation

- New pure utility, `shared/ingredient-scaling.util.ts`, mirroring the
  existing `shared/recipe-time.util.ts` /
  [image-url.util.ts](../src/app/shared/image-url.util.ts) pattern of a
  small dependency-free module the components import functions from:
  - `hasScalableIngredients(content: string): boolean` — cheap check used
    to decide whether to render the scale control at all.
  - `scaleIngredientsMarkdown(content: string, factor: number): string` —
    the section-scan-and-rewrite described above. Internally splits
    `content` into lines once, walks them with a small state machine
    (`inIngredientsSection: boolean`), and only re-joins with `\n` at the
    end — no regex operates across the whole blob at once, which is what
    keeps `## Instructions` numbered steps safe from being touched.
  - `parseQuantityToken(token: string): number | null` and
    `formatScaledQuantity(value: number, wasFraction: boolean): string` as
    the two directly-unit-testable halves of the line rewrite.
  - Fraction rounding uses a fixed table of eighths (`0, 1/8, 1/4, 3/8,
    1/2, 5/8, 3/4, 7/8`) plus whole numbers — pick the nearest one, same
    idea as a kitchen measuring-cup set.
- Regex for the leading token (illustrative, not final):
  `/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+\.\d+|\d+)(?=[a-zA-Z\s]|$)/` — matches
  mixed numbers, simple fractions, decimals, and bare integers, with a
  lookahead requiring the next character to be a letter, whitespace, or
  end-of-line (so it doesn't, say, false-positive mid-word).

### Files touched

- New `shared/ingredient-scaling.util.ts` + `ingredient-scaling.util.spec.ts`.

---

## Part 2 — Scale control on the recipe detail page

### Behavior

- The control only appears when `hasScalableIngredients(recipe.content)` is
  true — a recipe whose ingredients don't parse (no heading, or nothing
  with a leading quantity) shows the page exactly as it does today, with no
  dead control sitting on the page.
- Two presentations, chosen by whether the recipe has a stored `servings`
  value (nullable per baseline):
  - **`servings` is set:** a stepper reading "Servings: [－] N [＋]",
    seeded at the recipe's own `servings`, minimum 1. The effective scale
    factor is always `currentTarget / recipe.servings` — this is the more
    intuitive framing ("I need to feed 6, this recipe makes 4") and reuses
    a value the user already sees in the properties panel.
  - **`servings` is `null`:** no baseline to compute a ratio against, so
    instead a plain multiplier control — a segmented button group (`0.5×
    1× 1.5× 2× 3×`) — sets the scale factor directly.
- Changing the control re-renders only the ingredient quantities; the rest
  of the rendered Markdown (instructions, any prose) is byte-for-byte the
  same as before, since `scaleIngredientsMarkdown` only ever rewrites lines
  inside the `## Ingredients` section.
- The control resets to its default (servings stepper at the recipe's own
  `servings`, or 1× for the multiplier) every time a different recipe
  loads — it is not remembered across navigation, reload, or between
  recipes. (See "Deferred" for the localStorage option this rules out for
  now.)
- Placement: a small row between `<app-properties-panel>` and the
  `<hr class="detail-divider">` in `recipe-detail.component.html`, so it
  reads as "adjust before you look at ingredients" rather than being buried
  inside the Markdown body it affects.

### Implementation

- `RecipeDetailComponent`:
  - `scaleFactor = signal(1)`, reset to `1` in `ngOnInit`'s `next` handler
    right alongside the existing `this.recipe.set(data)`.
  - `canScale = computed(() => hasScalableIngredients(this.recipe()?.content ?? ''))`.
  - `renderedContent` changes from a plain signal set once in the
    subscribe callback to a `computed()` depending on both `recipe` and
    `scaleFactor`: `marked.parse(scaleIngredientsMarkdown(r.content,
    scaleFactor()))`, then the same `sanitizer.bypassSecurityTrustHtml()`
    call as today. The subscribe callback keeps setting `recipe` and
    `loading`/`error`; it no longer computes HTML directly.
  - `onServingsTargetChange(target: number)` — guards `target >= 1`, sets
    `scaleFactor.set(target / recipe()!.servings!)`.
  - `onMultiplierSelect(factor: number)` — sets `scaleFactor.set(factor)`
    directly.
  - Displayed target servings (for the stepper's number) is a small
    `computed()`: `Math.round(recipe()!.servings! * scaleFactor())` — the
    stepper shows/edits this rounded integer, not the raw factor.
- `recipe-detail.component.html`: new `@if (canScale())` block between the
  properties panel and the divider, with an inner `@if (r.servings; as s)
  { ...stepper... } @else { ...segmented buttons... }`.
- CSS: small `.scale-control` block in `recipe-detail.component.scss`
  reusing existing button/stepper visual patterns already in the app
  rather than introducing new ones.

### Files touched

- [recipe-detail.component.ts](../src/app/components/recipe-detail/recipe-detail.component.ts):
  `scaleFactor`, `canScale`, `renderedContent` becomes a `computed`,
  handlers for both control types.
- [recipe-detail.component.html](../src/app/components/recipe-detail/recipe-detail.component.html) /
  `.scss`: the new control block.
- [recipe-detail.component.spec.ts](../src/app/components/recipe-detail/recipe-detail.component.spec.ts):
  new cases (see Testing).

---

## Testing

- **`ingredient-scaling.util.spec.ts`** — the bulk of the real test
  surface, since this is where the heuristics live:
  - `parseQuantityToken`: integer, decimal, simple fraction, mixed number,
    a number glued to a unit (`400g` → `400`), and non-numeric text (`salt`
    → `null`).
  - `formatScaledQuantity`: fraction-style rounds to the nearest eighth and
    renders as a plain mixed number (never unicode, never improper);
    decimal-style trims trailing zeros; a value that rounds to zero is
    clamped rather than emitted as `0`.
  - `scaleIngredientsMarkdown`: a full recipe body scales every bulleted
    quantity line inside `## Ingredients`; non-quantity lines (`salt to
    taste`) pass through byte-for-byte; numbered `## Instructions` steps
    are never touched even though they also start with digits; a recipe
    with no `## Ingredients` heading returns `content` unchanged; a factor
    of `1` returns output equal to the input (modulo the eighth-rounding
    normalization, which is worth asserting explicitly so it isn't a
    surprise).
  - `hasScalableIngredients`: true for a normal recipe, false for one with
    no heading or an ingredients section that's entirely non-numeric lines
    (e.g. a recipe whose only ingredient is "salt to taste").
- **`recipe-detail.component.spec.ts`**:
  - The scale control renders only when `canScale()` is true.
  - A recipe with `servings` set shows the stepper seeded at that value; a
    recipe with `servings: null` shows the multiplier buttons instead.
  - Changing either control updates `renderedContent()` — assert the
    rendered HTML contains the newly scaled number and no longer contains
    the original one.
  - Loading a second recipe (simulating route-param navigation) resets
    `scaleFactor()` back to its default rather than carrying over the
    previous recipe's setting.

---

## Suggested sequencing

1. **Part 1** — the parsing/formatting utility and its tests. Fully
   testable in isolation with plain strings, no component or DOM involved.
2. **Part 2** — wire it into `RecipeDetailComponent` once Part 1's
   behavior is trusted. The `renderedContent` signal→computed conversion is
   the only structural change to existing code; everything else is
   additive.

## Deferred

- Structured `Ingredient`/`Quantity`/`Unit` entities (`FUTURE_IDEAS.md`
  item 12) — the real fix for every heuristic gap listed under "Explicitly
  out of scope" above, at the cost of a backend migration and a content-
  editing UI rewrite. Worth revisiting if the regex gaps turn out to bite
  often in practice.
- Remembering the last-used scale factor per recipe (e.g. in
  `localStorage`, mirroring the pattern `FUTURE_IDEAS.md` item 9 proposes
  for favorites) — deliberately left as view-only, reset-on-load state for
  this pass to keep the surface area small.
- Unit-aware rounding of discrete-item counts (whole eggs, whole tortillas)
  instead of showing `4.5 eggs`.
- Feeding scaled quantities into a shopping-list export (`FUTURE_IDEAS.md`
  item 14) — that feature would consume `scaleIngredientsMarkdown`/
  `parseQuantityToken` from Part 1, but building the shopping list itself
  is out of scope here.
