# Structured Ingredients & Steps

Design spec for [FUTURE_IDEAS.md](FUTURE_IDEAS.md) item 12: replace the
Ingredients and Instructions sections currently embedded in the single Markdown
`content` field with ordered, structured data. This removes the parsing
heuristics documented in [INGREDIENT_SCALING_SPEC.md](INGREDIENT_SCALING_SPEC.md)
and creates a stable base for scaling, shopping-list export, and a later
step-by-step cook mode.

The recipe keeps an optional Markdown `content` field, relabeled **Notes**, for
freeform context that does not fit an ingredient or step. Structured
`ingredients` and `steps` are authoritative; the detail page never attempts to
merge or reparse Notes into either list.

**Explicitly out of scope:**

- Unit conversion (`3 tsp` to `1 tbsp`) or automatic metric/US conversion
- Combining equivalent ingredients across recipes for a shopping list
- Step timers, progress persistence, voice controls, or a dedicated cook-mode
  screen; ordered steps make that possible but do not implement it
- Ingredient groups such as "For the sauce" and reusable sub-recipes
- Nutrition calculation, pantry inventory, or ingredient autocomplete from an
  external catalog
- Separate ingredient/step CRUD endpoints; recipes continue to save as one
  aggregate through the existing `POST /recipes` and `PUT /recipes/{id}`
- Lossless automatic conversion of arbitrary user-authored Markdown

## Key decisions

- **Children belong to the recipe aggregate.** `Ingredient` and `RecipeStep`
  are real JPA child entities with generated internal IDs, `@ManyToOne` back to
  `Recipe`, cascade-all, and orphan removal. Request/response DTOs expose them
  as ordered value arrays without IDs because the existing update endpoint
  replaces all mutable recipe fields at once. Reordering or deleting rows does
  not need its own API operation.
- **Order is data.** Both collections use `@OrderColumn` (`position`) and the
  API preserves array order. The frontend uses that order directly and submits
  the full array after add/remove/reorder operations.
- **Quantities are numeric but ranges are first-class.** An ingredient has
  nullable `quantity` and `quantityMax` decimal values, a nullable freeform
  `unit`, required `name`, and nullable `note`. `2-3 cloves garlic` is
  `{ quantity: 2, quantityMax: 3, unit: "clove", name: "garlic" }`; `salt to
taste` leaves both quantities and unit null and stores `to taste` as its
  note. `BigDecimal` is used in Java and JSON numbers in OpenAPI so scaling
  does not depend on parsing display text.
- **Units stay open text for this pass.** A closed enum cannot represent the
  existing data (`packet`, `slice`, `sprig`, `ball`, and user-specific units)
  without an ever-growing schema. The editor offers common unit suggestions
  but accepts custom values. Canonical unit aliases and conversion rules belong
  with shopping-list aggregation, not persistence.
- **Steps contain one required instruction string.** Their order supplies the
  step number; numbers are not stored in the instruction and are regenerated
  for display. Step titles, timers, and linked ingredients are deferred until
  cook mode has concrete interaction requirements.
- **Notes remain Markdown.** The existing CodeMirror editor and rendered
  Markdown body continue to support tips, serving context, and source links,
  but `content` becomes nullable and is no longer required to create a recipe.
  At least one ingredient and one step are required instead.

## Data and API shape

Backend additions:

- `Ingredient`: `id`, `recipe`, `quantity: BigDecimal?`,
  `quantityMax: BigDecimal?`, `unit: String?`, `name: String`, and
  `note: String?`.
- `RecipeStep`: `id`, `recipe`, and `instruction: String`.
- `Recipe`: ordered `ingredients` and `steps` collections initialized to mutable
  empty lists. Helper methods replace children while setting both sides of the
  relationship, avoiding detached back-references during create/update.
- `RecipeRequest` and `RecipeResponse`: ordered `ingredients` and `steps`
  arrays using nested `IngredientDto`/`RecipeStepDto` schemas. `content` remains
  under the same JSON key for compatibility but is nullable and described as
  optional Markdown notes.

Validation mirrors between Jakarta annotations and `openapi.yaml`:

- `ingredients` and `steps`: required, 1-100 items each
- `quantity`/`quantityMax`: greater than 0 when present; `quantityMax` must be
  greater than or equal to `quantity` through a small class-level validator
- `unit`: trimmed, 30 characters maximum
- ingredient `name`: nonblank, 255 characters maximum
- ingredient `note`: 255 characters maximum
- step `instruction`: nonblank, 2,000 characters maximum
- Notes (`content`): nullable, 50,000 characters maximum

A representative request becomes:

```json
{
  "title": "Pancakes",
  "description": "A simple weekend breakfast",
  "content": "Rest the batter for 5 minutes before cooking.",
  "servings": 4,
  "ingredients": [
    {
      "quantity": 1.5,
      "quantityMax": null,
      "unit": "cup",
      "name": "all-purpose flour",
      "note": null
    },
    { "quantity": null, "quantityMax": null, "unit": null, "name": "salt", "note": "to taste" }
  ],
  "steps": [
    { "instruction": "Whisk the dry ingredients together." },
    { "instruction": "Add the wet ingredients and stir until just combined." }
  ]
}
```

`RecipeService.create()` maps both arrays into owned children. `update()`
replaces the managed collections in place so orphan removal deletes removed
rows and ordering is rewritten consistently. `toResponse()` maps in collection
order. Repository reads used for recipe detail fetch both collections within
the service transaction; list responses initially include them too, matching
the current single `RecipeResponse` contract and avoiding a second summary DTO
in this pass.

After updating `openapi.yaml`, regenerate the Angular client with the existing
`api:generate` script rather than hand-editing generated models.

## Frontend shape

`RecipeFormComponent` replaces the required Content editor with three sections:

- **Ingredients:** a typed `FormArray` of rows containing quantity, optional end
  quantity, unit, name, and note. Rows have icon buttons for remove and
  drag-handle reordering, an **Add ingredient** command, inline validation, and
  stable labels for assistive technology. Quantity inputs accept decimals; a
  range toggle reveals the end-quantity input instead of showing every row in
  its widest form.
- **Steps:** a typed `FormArray` of instruction controls shown with generated
  step numbers, remove/reorder controls, and **Add step**. Enter in a populated
  step adds the next row; multiline instructions remain possible with
  Shift+Enter.
- **Notes (optional):** the existing `MarkdownEditorComponent`, with its current
  form value mapped to `content`.

The two repeatable editors become focused standalone components because their
row manipulation, validation messages, keyboard behavior, and templates are
substantial. They implement `ControlValueAccessor` over typed value arrays so
`RecipeFormComponent` retains ownership of submit/load behavior without
embedding nested editor details. Reordering must also be available through
keyboard-accessible Move up/Move down actions; drag and drop is an enhancement,
not the only path.

`RecipeDetailComponent` renders a semantic Ingredients list and ordered Steps
list before optional Notes. Scaling works directly from numeric quantities and
`servings`: it derives display values without mutating the stored arrays,
scales both ends of ranges, leaves quantity-free ingredients unchanged, and
uses the existing fraction/decimal formatting rules where practical. Notes are
passed through `marked` exactly as `content` is today.

Clone behavior copies both arrays by value along with Notes. Search continues
to target title/description only in this pass; matching ingredient names can be
added server-side later without changing the structured contract.

## Existing data and rollout

This is an additive schema change but a semantic change to `content`. Roll it
out in this order:

1. Add child tables, DTOs, mapping, and nullable Notes while retaining the old
   `content` JSON key.
2. Convert `mock-recipes.json` to explicit ingredient/step arrays and move any
   non-list prose into `content` as Notes.
3. Add a one-off, tested migration command for local persisted recipes. It
   recognizes only `## Ingredients` plus `## Instructions`/`## Steps`, reports
   rows it cannot convert, and never overwrites a recipe that already has
   structured children. This parser is migration tooling, not runtime display
   behavior.
4. Land the generated client and frontend editors/detail rendering only after
   the backend accepts and returns both arrays.

Because the current development database relies on Hibernate
`ddl-auto=update`, adding tables is sufficient for local schema creation. A
real production database still requires an explicit Flyway/Liquibase migration
before this feature can be deployed; silently parsing arbitrary Markdown at
application startup is deliberately rejected because a partial conversion
could corrupt user recipes.

During the transition, a legacy recipe with no structured children remains
readable through its Notes Markdown and is clearly marked **Legacy recipe** in
the editor. Saving is blocked until the user runs conversion or enters at least
one ingredient and step, so an edit cannot accidentally erase the only copy of
its recipe body.

## Testing

Backend tests cover nested validation (empty arrays, blank names/instructions,
invalid quantity ranges, and limits), create/read ordering, full replacement
with reorder/add/remove, orphan deletion, ownership enforcement on nested
updates, and response mapping without recursive serialization. A migration
unit test covers recognized headings, quantity ranges, quantity-free lines,
and no-op behavior for already-structured or unrecognized content.

Frontend component tests cover adding/removing rows, range controls, preserving
array order, keyboard reordering, validation visibility, edit and clone
prefill, payload mapping, optional Notes, and prevention of an empty
ingredient/step submit. Detail tests cover semantic list rendering, range and
quantity-free scaling, generated step numbering, Notes rendering, and legacy
fallback. Regenerated API models must pass the existing typecheck before the
component tests run.

## Deferred

- Ingredient groups and reusable sub-recipes
- Canonical units, conversion, and cross-recipe shopping-list aggregation
- Ingredient-name search/filtering
- Dedicated cook mode with timers, progress, and wake-lock behavior
- Nutrition data or integration with an external ingredient catalog
