# Recipe List: Grid / List View Modes

Design spec for adding a view-mode toggle to `RecipeListComponent`: recipes can be browsed as the existing card grid or a denser single-column list.

Adds a second layout over the same `recipes()` data already loaded — switching modes re-renders instantly (no refetch) and persists the choice to `localStorage`. View mode is local component state, not a new service, mirroring `ThemeService`'s persisted-signal pattern but scoped locally since it only affects this one page (per this repo's bias against introducing abstractions beyond what's needed).

**Explicitly out of scope:** sorting, filtering/search, tag chips on cards (deferred to `OBSIDIAN_EDITOR_SPEC.md`), pagination/virtual scroll.

## Shape of the change

- Toggle group: two icon buttons (`grid_view`/`view_list`, both already in Material Icons) in `.recipe-list-header`, right-aligned, mutually exclusive, `aria-pressed` + `aria-label` (icon-only), reusing the existing `ButtonDirective`. Default is grid mode.
- `viewMode = signal<'grid'|'list'>(initialViewMode())`, seeded from `localStorage.getItem('recipeListViewMode')` (mirrors `ThemeService`'s `initialDarkMode()`); `setViewMode()` sets the signal and writes through to localStorage.
- Template branches the same `@for` over `recipes()` between the unchanged `.recipe-grid` and a new `.recipe-list`: single-column stacked rows, title+description left (description ellipsis-truncates to one line), date/actions right, `flex` row wrapping to two lines only on narrow viewports, rows separated by `--color-border` bottom borders instead of card boxes. Same click targets/behavior as grid mode in both, including the `deleting()` disabled state.
- SCSS uses existing tokens only; no new design tokens. No backend/openapi changes — purely client-side over data `GET /recipes` already returns. Empty/error/loading states are unaffected by view mode.

## Testing

Default grid mode with no stored preference; toggle switches markup and persists to `localStorage` (picked back up on reload); Edit/Delete parameterized across both modes rather than duplicating the suite; `aria-pressed` correctness after switching.

## Deferred

Sort/filter controls next to the view toggle; tag chips in both layouts once `OBSIDIAN_EDITOR_SPEC.md`'s properties panel ships.
