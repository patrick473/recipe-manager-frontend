# Recipe List: Grid / List View Modes

Design spec for adding a view-mode toggle to `RecipeListComponent`, so recipes
can be browsed as the current card grid or as a denser single-column list.

**Explicitly out of scope for this pass:** sorting, filtering/search, tag
chips on cards (deferred in `OBSIDIAN_EDITOR_SPEC.md`), pagination/virtual
scroll. This spec only adds a second layout for the same `recipes()` data
already loaded today.

---

## Current state (baseline)

- `RecipeListComponent` ([recipe-list.component.ts](../src/app/components/recipe-list/recipe-list.component.ts)) loads all recipes into a `recipes = signal<Recipe[]>([])` and renders them in `RecipeListComponent`'s template ([recipe-list.component.html](../src/app/components/recipe-list/recipe-list.component.html)) as `.recipe-grid > .recipe-card` — a CSS grid (`repeat(auto-fill, minmax(16.25rem, 1fr))`) of cards, each with title, description, updated date, and Edit/Delete actions.
- There is exactly one layout today; no per-user display preference exists anywhere in `RecipeListComponent`.
- `ThemeService` ([theme.service.ts](../src/app/services/theme.service.ts)) is the app's only precedent for a persisted UI preference: a signal seeded from `localStorage` on construction, exposing `set()`/`toggle()` that write through to `localStorage` immediately. This spec follows the same shape but scoped locally to the component rather than a new root service, since view mode only affects this one page (`CLAUDE.md` / style spec bias against introducing abstractions beyond what's needed).
- `IconComponent` ([icon.component.ts](../src/app/shared/icon/icon.component.ts)) renders Material Icons ligatures by name (`<app-icon name="pencil">`). Material Icons already includes `grid_view` and `view_list`, so no new icon assets are needed.

---

## Behavior

- A two-button toggle group appears in `.recipe-list-header`, right-aligned next to the "Recipes" heading: a grid icon button and a list icon button, mutually exclusive (radio-like), each with `aria-pressed` reflecting the active mode and an `aria-label` (`"Grid view"` / `"List view"`) since the buttons are icon-only.
- Default mode is **grid** (today's behavior) when no preference is stored yet.
- Selecting a mode re-renders the same `recipes()` array in the new layout instantly (no refetch) and persists the choice to `localStorage` so it's remembered on the next visit.
- **Grid mode**: unchanged — today's `.recipe-grid` card layout.
- **List mode**: single-column stacked rows, one per recipe, denser than the card grid:
  - Row layout: title + description in a left column (description truncates to one line with `text-overflow: ellipsis` instead of wrapping, since rows are short), updated date and Edit/Delete actions in a right-aligned cluster — everything on one horizontal row per recipe (`display: flex`, wraps to two lines only on narrow viewports).
  - Rows are separated by `--color-border` bottom borders rather than being individual `.card` boxes, so the list reads as one compact block instead of a stack of cards.
  - Same click targets as grid mode: title links to detail, Edit/Delete buttons behave identically (including the existing `deleting()` disabled state during delete).
- Empty state and error/loading states are unaffected by view mode — they render the same regardless of which mode is selected (an empty list looks the same either way).

---

## Implementation

- `RecipeListComponent`: add `protected readonly viewMode = signal<'grid' | 'list'>(initialViewMode())`, where `initialViewMode()` is a small module-level function reading `localStorage.getItem('recipeListViewMode')` (mirroring `ThemeService`'s `initialDarkMode()` pattern) — no new service.
- `setViewMode(mode: 'grid' | 'list')` method sets the signal and writes `localStorage.setItem('recipeListViewMode', mode)`.
- Template: wrap the existing `.recipe-grid` block and a new `.recipe-list` block in `@if (viewMode() === 'grid')` / `@else`, both iterating the same `recipes()` with the same `@for (recipe of recipes(); track recipe.id)` — the `<a>`/`<button>` actions inside each are identical logic to today's card, just re-laid-out markup for the list row.
- Toggle group markup: two `<button type="button" appButton appearance="secondary" size="s">`-style icon buttons (reusing the existing `ButtonDirective` so it matches the app's existing button styling rather than inventing a new control), with an `.active` class (or `[attr.aria-pressed]`) driving a highlighted state in SCSS.
- SCSS (`recipe-list.component.scss`): add `.view-toggle` (flex row, small gap) and `.recipe-list` / `.recipe-list-row` rules using existing tokens (`--space-*`, `--color-border`, `--color-text-muted`, `--font-size-sm`) — no new design tokens needed.
- No backend or `openapi.yaml` changes — this is purely a client-side rendering/preference feature over data already returned by `GET /recipes`.

### Files touched

- [recipe-list.component.ts](../src/app/components/recipe-list/recipe-list.component.ts): add `viewMode` signal, `initialViewMode()` helper, `setViewMode()` method.
- [recipe-list.component.html](../src/app/components/recipe-list/recipe-list.component.html): add the toggle group; branch the recipe rendering block on `viewMode()`.
- [recipe-list.component.scss](../src/app/components/recipe-list/recipe-list.component.scss): add `.view-toggle`, `.recipe-list`, `.recipe-list-row` (and related child) rules.
- [recipe-list.component.spec.ts](../src/app/components/recipe-list/recipe-list.component.spec.ts): extend with cases per "Testing" below.

---

## Testing

- Default mode is grid when `localStorage` has no stored preference.
- Clicking the list toggle switches rendered markup to `.recipe-list-row` elements and sets `localStorage.getItem('recipeListViewMode')` to `'list'`; reloading the component (simulating a fresh navigation) picks that value back up.
- Edit/Delete actions in list mode call the same `deleteRecipe()`/routerLink behavior already covered by existing grid-mode tests — extend those cases to run against both modes rather than duplicating the whole suite, e.g. via a small `describe.each`-style helper or a shared setup function parameterized on `viewMode`.
- Toggle buttons expose correct `aria-pressed` state after switching (accessibility regression guard).

---

## Suggested sequencing

1. Add the `viewMode` signal + `localStorage` persistence to `RecipeListComponent` with the toggle group wired up, grid branch unchanged, list branch initially just reusing `.recipe-grid` markup (proves the toggle/persistence works before styling the new layout).
2. Build out the real `.recipe-list-row` markup and SCSS for the dense list layout.
3. Extend `recipe-list.component.spec.ts` for both modes.
4. Follow-up, deliberately deferred: sort/filter controls next to the view toggle, tag chips in both layouts once `OBSIDIAN_EDITOR_SPEC.md`'s properties panel ships.
