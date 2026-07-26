# Recipe List Quick Wins: Search, Sort, Total Time, Duplication & State Polish

Design spec for the five "Quick wins" in [FUTURE_IDEAS.md](FUTURE_IDEAS.md):
search & tag filtering, sort controls, empty/error state polish, recipe
duplication, and total time display. Grouped into one spec because they're
small, mostly touch the same files, and were scoped together in the backlog —
each part below can still ship independently.

**Explicitly out of scope for this pass:** server-side search/filter/
pagination (`FUTURE_IDEAS.md` item 6 — only matters once recipe count outgrows
a single-payload fetch; today's `getAll()` returning everything is exactly
what makes all-client-side filtering/sorting here viable), image support,
ingredient scaling, favorites, print view, auth, and structured
ingredients/steps — all separately tracked further down the backlog.

---

## Current state (baseline)

- `RecipeListComponent` ([recipe-list.component.ts](../src/app/components/recipe-list/recipe-list.component.ts)) loads all recipes via `RecipeService.getAll()` into `recipes = signal<Recipe[]>([])` and already has a grid/list view-mode toggle (`viewMode` signal, `localStorage`-persisted) per `RECIPE_LIST_VIEW_MODES_SPEC.md` — both layouts iterate the same `recipes()` array today with no filtering or sorting step in between.
- `RecipeResponse`/`RecipeRequest` (`openapi.yaml`) already carry `tags: string[]`, `prepTimeMinutes`, `cookTimeMinutes`, and `servings` per `OBSIDIAN_EDITOR_SPEC.md`'s Properties panel work — **no backend or `openapi.yaml` changes are needed for any part of this spec**; everything here operates on fields already returned by `GET /recipes`.
- `PropertiesPanelComponent` ([properties-panel.component.scss](../src/app/shared/properties-panel/properties-panel.component.scss)) already defines `.tag-chip` styling for rendering tags — the established chip look to reuse/extend rather than inventing a new one.
- `RecipeService` ([recipe.service.ts](../src/app/services/recipe.service.ts)) already exposes `create()` (POST, used today by `RecipeFormComponent` for new recipes) — duplication is a thin layer over the existing create path, not a new endpoint.
- `ButtonDirective` (`appButton`) and `IconComponent` (`app-icon`, Material Icons ligatures) are the established action-button/icon primitives across `RecipeListComponent`/`RecipeDetailComponent` — new buttons introduced here (Clone, sort direction) should reuse them.
- `.notification.notification-negative` (defined once in [_utilities.scss](../src/styles/_utilities.scss)) is the shared error-banner class used identically by `RecipeListComponent`, `RecipeDetailComponent`, and `RecipeFormComponent` today.
- None of search, sort, total-time, duplication, or dedicated "no results" empty state exist anywhere in the app today.

---

## Part 1 — Search & tag filtering

### Behavior

- A toolbar row in `RecipeListComponent`, alongside the existing grid/list toggle: a text `<input type="search">` (placeholder "Search recipes…") plus a row of toggleable tag chips — one per distinct tag across all loaded recipes.
- Search matches case-insensitive substring against `title` and `description`.
- Tag chips use **OR** semantics among themselves (selecting "breakfast" and "quick" shows recipes with _either_ tag), intersected with the search text using **AND** (must match search text and at least one selected tag, if any are selected).
- If no recipe has any tags, the tag-chip row doesn't render — nothing to filter by.
- Purely a computed filter over the already-fetched `recipes()` signal — no new HTTP calls, no debounce needed (it's an in-memory array scan, not a network request).
- Both grid and list view modes (Part of `RECIPE_LIST_VIEW_MODES_SPEC.md`) read from the same filtered result, so filtering behaves identically regardless of `viewMode()`.

### Implementation

- `RecipeListComponent`: add `searchText = signal('')` and `activeTags = signal<ReadonlySet<string>>(new Set())`.
- `availableTags = computed(() => [...new Set(this.recipes().flatMap((r) => r.tags ?? []))].sort())`.
- `filteredRecipes = computed(() => ...)` — filters `recipes()` by `searchText()`/`activeTags()`; **replaces** `recipes()` in both the grid and list `@for` blocks and in the existing empty-state length check.
- `toggleTag(tag: string)` flips membership in `activeTags` (builds a new `Set` each call, keeping signal immutability consistent with the rest of the component).
- `onSearchInput(event: Event)` sets `searchText` from `(event.target as HTMLInputElement).value` — a plain input handler like `PropertiesPanelComponent.onNewTagInput`, no `ReactiveFormsModule` needed for a single throwaway field.
- Template: new `.recipe-list-toolbar` region with the search input and, when `availableTags().length > 0`, chip buttons (`[class.active]` + `aria-pressed`, mirroring the existing `.view-toggle button.active` pattern).
- SCSS: `.recipe-search-input` (reuse `.tag-input`'s focus treatment from `properties-panel.component.scss` as a reference) and `.filter-chip`/`.filter-chip.active` (a toggleable variant of `.tag-chip`).

### Files touched

- [recipe-list.component.ts](../src/app/components/recipe-list/recipe-list.component.ts): `searchText`, `activeTags`, `availableTags`, `filteredRecipes`, `toggleTag()`, `onSearchInput()`.
- [recipe-list.component.html](../src/app/components/recipe-list/recipe-list.component.html): toolbar markup; swap `recipes()` → `filteredRecipes()` in both view-mode branches.
- [recipe-list.component.scss](../src/app/components/recipe-list/recipe-list.component.scss): toolbar/chip styles.
- [recipe-list.component.spec.ts](../src/app/components/recipe-list/recipe-list.component.spec.ts): search-text filtering, tag-chip toggling, combined search+tag filtering.

---

## Part 2 — Sort controls

### Behavior

- A sort `<select>` (Title, Prep time, Cook time, Created date, Updated date) plus a direction icon-button (ascending/descending), replacing today's fixed "always ascending by id" order.
- Applies **after** Part 1's search/tag filtering — sorting operates on the filtered set, not the raw `recipes()`.
- Sort choice (field + direction) persists to `localStorage`, following the exact precedent `viewMode` already set: seed a signal from storage on init, write through on every change. New keys `recipeListSortKey`/`recipeListSortDir` reuse that same shape rather than introducing a new persistence mechanism.
- `prepTimeMinutes`/`cookTimeMinutes` can be `null` — nulls always sort last regardless of direction, so incomplete recipes don't jump to the top when sorting descending.

### Implementation

- `type SortKey = 'title' | 'prepTimeMinutes' | 'cookTimeMinutes' | 'createdAt' | 'updatedAt'`; `type SortDir = 'asc' | 'desc'`.
- `sortKey = signal<SortKey>(initialSortKey())`, `sortDir = signal<SortDir>(initialSortDir())` — module-level `initialSortKey()`/`initialSortDir()` functions reading `localStorage`, mirroring `initialViewMode()`.
- `sortedRecipes = computed(() => [...this.filteredRecipes()].sort(comparator))` — spread before `.sort()` since it mutates in place and `filteredRecipes()` is derived from the `recipes` signal's backing array.
- `setSort(key: SortKey)`: if `key === sortKey()`, flip `sortDir`; otherwise set the new key with `dir` reset to `'asc'` (standard sortable-column-header behavior) — writes through to `localStorage` immediately, same as `setViewMode`.
- Template: swap `filteredRecipes()` → `sortedRecipes()` in both view-mode branches; add the sort `<select>` + direction button (`arrow_upward`/`arrow_downward` Material ligatures) to `.recipe-list-toolbar`.

### Files touched

Same files as Part 1 (`recipe-list.component.ts`/`.html`/`.scss`/`.spec.ts`) — naturally sequenced right after it.

---

## Part 3 — Total time display

### Behavior

- Cards (grid), rows (list), and `RecipeDetailComponent`'s meta line show "Total: X min" computed as `prepTimeMinutes + cookTimeMinutes`.
- If **both** are `null`, nothing renders — avoids implying a recipe takes "0 min".
- If only one is set, the missing one counts as `0` in the sum (a recipe with only cook time set still gets a meaningful total) — a deliberate judgment call, not a hard requirement, worth confirming reads right in review.
- On `RecipeDetailComponent`, shown next to the existing Created/Updated line in `.detail-meta` — visible without expanding the Properties panel below it.

### Implementation

- New small pure helper, `src/app/shared/recipe-time.util.ts`, exporting `totalTimeMinutes(recipe: Pick<Recipe, 'prepTimeMinutes' | 'cookTimeMinutes'>): number | null` — a shared util (rather than duplicating the "both null → null, else sum treating null as 0" rule) since it's used from two components.
- `RecipeListComponent`/`RecipeDetailComponent` templates: `@if (totalTimeMinutes(recipe); as total) { <span>Total: {{ total }} min</span> }`.
- SCSS: reuse the existing `.recipe-card-date`/`.recipe-list-row-date`/`.detail-meta` muted-text treatment — no new visual language needed.

### Files touched

- New: `src/app/shared/recipe-time.util.ts` (+ `.spec.ts`).
- [recipe-list.component.html](../src/app/components/recipe-list/recipe-list.component.html) / [.scss](../src/app/components/recipe-list/recipe-list.component.scss): total-time line on cards and rows.
- [recipe-detail.component.html](../src/app/components/recipe-detail/recipe-detail.component.html): total-time addition to `.detail-meta`.

---

## Part 4 — Recipe duplication ("Clone recipe")

### Behavior

- A "Clone" button in `RecipeDetailComponent`'s `.detail-actions`, alongside Edit/Delete (the required surface per `FUTURE_IDEAS.md`; a clone action on list cards/rows is an optional follow-on, not required here).
- Clicking Clone navigates to `/recipes/new` with the current recipe's fields pre-filled: title suffixed `" (Copy)"`, `description`/`content`/`tags`/`prepTimeMinutes`/`cookTimeMinutes`/`servings` copied verbatim. The user lands on the create form to review/tweak before saving — a normal POST on submit, not a one-click silent duplicate.
- `id`, `createdAt`, `updatedAt` are never copied — they're server-assigned like any other new recipe.

### Implementation

- Pass the source recipe through router navigation state — `this.router.navigate(['/recipes/new'], { state: { cloneFrom: recipe } })` — rather than a new `/recipes/:id/clone` route or query-stringifying the recipe. This keeps `/recipes/new` as the single "create" route (no `app.routes.ts` change) and avoids serializing a full Markdown `content` blob into a URL.
- `RecipeFormComponent.ngOnInit()`: alongside the existing `:id` param check for edit-mode, read `history.state['cloneFrom']` (survives past the initial navigation tick, unlike `router.getCurrentNavigation()` which is only valid synchronously during navigation) and, if present, `patchValue` the form from it with `title` set to `` `${source.title} (Copy)` ``. `isEdit`/`recipe` signals stay at their create-mode defaults — this is still a POST, not a PUT.
- `RecipeDetailComponent`: add `cloneRecipe()` calling the navigation above; template gets a new button next to Edit using the `content_copy` icon.
- No `RecipeService` change needed — `create()` already exists and is exactly what the form's normal submit path calls for a non-edit form.

### Files touched

- [recipe-detail.component.ts](../src/app/components/recipe-detail/recipe-detail.component.ts) / [.html](../src/app/components/recipe-detail/recipe-detail.component.html) (+ `.spec.ts`): `cloneRecipe()` + button.
- [recipe-form.component.ts](../src/app/components/recipe-form/recipe-form.component.ts) (+ `.spec.ts`): `cloneFrom` state read + prefill branch in `ngOnInit()`.

---

## Part 5 — Empty & error state polish

### Behavior

- Audit and tighten (not redesign) the non-happy-path states already coded in `RecipeListComponent`:
  - **Empty, no recipes at all** — today's `.empty-state` (heading + copy + "New Recipe" CTA). Confirm it still looks right in both grid and list view mode and alongside the new toolbar from Parts 1–2.
  - **Empty, filtered to zero results** — a _new_ state, introduced by Part 1: distinct copy ("No recipes match your search." + a "Clear filters" button) rather than reusing the "create your first recipe" messaging, since the fix here is adjusting the filter, not adding data.
  - **Error banner** (`.notification-negative`, "Failed to load recipes. Is the backend running?") — confirm contrast/spacing in both light and dark theme (`ThemeService`'s `data-theme` toggle) and that it doesn't visually collide with the new toolbar.
- Same triage on `RecipeDetailComponent`'s and `RecipeFormComponent`'s equivalent banners (404 "not found", load/submit failures) for consistency — they share the same `.notification-negative` class ([_utilities.scss](../src/styles/_utilities.scss)), so a single fix there likely covers all three components.

### Implementation

- Mostly a CSS/visual pass, except the new "filtered to zero" branch, which needs actual logic:
  ```
  @if (!loading() && recipes().length > 0 && sortedRecipes().length === 0) {
    <!-- "no matches" empty state with a Clear filters button -->
  }
  ```
  kept distinct from the existing `recipes().length === 0` branch (the "no recipes exist yet" case).
- `clearFilters()`: resets `searchText` to `''` and `activeTags` to an empty `Set`.
- Any shared visual fixes (e.g. `.notification` spacing/contrast) land once in [_utilities.scss](../src/styles/_utilities.scss) rather than duplicated per component.

### Files touched

- [recipe-list.component.html](../src/app/components/recipe-list/recipe-list.component.html) / [.scss](../src/app/components/recipe-list/recipe-list.component.scss) (+ `.spec.ts` for the new "no matches" branch and `clearFilters()`).
- [_utilities.scss](../src/styles/_utilities.scss): only if the audit finds a real shared issue.
- `recipe-detail`/`recipe-form` templates: only if the audit finds real issues there — this part is "check and fix what's actually wrong," not a prescribed rewrite.

---

## Testing

- Part 1: search text filters by title/description substring (case-insensitive); tag chips filter with OR-within-tags, AND-with-search-text; clearing search/tags restores the full list.
- Part 2: each `SortKey` sorts correctly in both directions; records with `null` `prepTimeMinutes`/`cookTimeMinutes` sort last in both directions; sort choice persists across a simulated reload (same pattern as the existing `viewMode` persistence test).
- Part 3: `totalTimeMinutes()` unit-tested directly — both null → `null`; one null → treats it as 0; both set → sum.
- Part 4: cloning pre-fills the form with the source recipe's fields and `" (Copy)"`-suffixed title; submitting calls `RecipeService.create()` (not `update()`); the cloned recipe's `id` is never reused.
- Part 5: the "no matches" empty state renders only when recipes exist but the filtered/sorted result is empty (not on true empty, not on error); "Clear filters" resets `searchText`/`activeTags` and restores the list.

---

## Suggested sequencing

1. **Part 1** (search/tag filter) — introduces `filteredRecipes()`, the foundation Part 2 and Part 5's "no matches" state build on.
2. **Part 2** (sort) — layers `sortedRecipes()` on top of `filteredRecipes()`; same files as Part 1, natural to land back-to-back.
3. **Part 3** (total time) — fully independent; smallest, lowest-risk change, a good warm-up if sequencing by size rather than dependency.
4. **Part 4** (clone) — independent of 1–3; touches `RecipeDetailComponent`/`RecipeFormComponent` instead of the list.
5. **Part 5** (empty/error polish) last — the "no matches" empty state can't be built or tested before `filteredRecipes()`/`sortedRecipes()` exist from Parts 1–2.
