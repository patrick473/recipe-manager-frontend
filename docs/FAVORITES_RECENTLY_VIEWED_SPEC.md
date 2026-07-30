# Favorites & Recently Viewed

Design spec for [FUTURE_IDEAS.md](FUTURE_IDEAS.md) item 9: "localStorage-backed,
no backend change, quick to build on top of the existing signals pattern."
This spec holds to that framing on both counts:

- **No backend or `openapi.yaml` change of any kind.** In particular, there is
  no bulk `GET /recipes?ids=...` endpoint added, even though one would make
  Part 4 below simpler. Since `SERVER_SIDE_SEARCH_PAGINATION_SPEC.md` shipped,
  `GET /recipes` is paginated — `RecipeListComponent` no longer holds every
  recipe in memory to filter/slice client-side (see baseline below), so a
  favorites/recently-viewed list can't just index into an array that's already
  sitting in the browser. This spec accepts fetching each stored id
  individually via the existing single-recipe `getById()` (fanned out with
  `forkJoin`) rather than adding a new endpoint — a few small parallel
  requests instead of one bulk one. That's the deliberate tradeoff for
  staying a "no backend change" Medium feature rather than growing into a
  bigger-investment API change; see "Deferred" for the bulk-endpoint option
  if this ever needs to scale past a handful of ids.
- **No new routes.** Favorites and recently-viewed surface as two optional
  strips directly on the existing `/recipes` list page rather than dedicated
  `/recipes/favorites` / `/recipes/recent` pages — no `app.routes.ts` change,
  no new nav.

**Explicitly out of scope for this pass:**

- Any backend or `openapi.yaml` change, including a bulk fetch-by-ids
  endpoint.
- Cross-device sync — `localStorage` is per-browser, exactly like the
  existing `viewMode`/sort-preference persistence this spec follows.
- Dedicated `/recipes/favorites` or `/recipes/recent` routes.
- Any effect on the main paginated/filtered/sorted `recipes()` list, its
  query params, or its pager — the two strips are additive UI reading
  independently-fetched data, never touching `loadRecipes()`.
- A user-configurable recently-viewed history size — fixed at a constant.
- A bulk "clear all favorites" action — removing one is already a single
  heart-click away via the toggle (Part 2); "Clear" is only offered for
  recently-viewed history (see Part 4), since that's passive history rather
  than a deliberate user choice.
- Tracking a "view" anywhere except `RecipeDetailComponent` successfully
  loading a recipe (e.g. not from hovering a card, not from the clone/edit
  form).

---

## Current state (baseline)

- `RecipeListComponent` ([recipe-list.component.ts](../src/app/components/recipe-list/recipe-list.component.ts))
  loads one **page** of recipes into `recipes = signal<Recipe[]>([])` via
  `RecipeService.getAll()` (line 163-190) — per
  `SERVER_SIDE_SEARCH_PAGINATION_SPEC.md`, this is server-side paginated
  (`q`/`tags`/`sort`/`page`), not the full table. There is no in-memory array
  of every recipe to slice by id anymore.
- The `viewMode`/`sortKey`/`sortDir` module-level functions (lines 24-52) are
  the established localStorage precedent this spec follows: seed a signal
  from `localStorage.getItem(...)` on init with a safe fallback for a
  missing/invalid value, write through with `localStorage.setItem(...)` on
  every change, no debounce.
- `RecipeDetailComponent` ([recipe-detail.component.ts](../src/app/components/recipe-detail/recipe-detail.component.ts))'s
  `ngOnInit` (line 97-116) subscribes to `RecipeService.getById(id)` and, in
  the `next` handler, sets `this.recipe` and resets `scaleFactor` (line
  104-105, added per `INGREDIENT_SCALING_SPEC.md`) — the natural insertion
  point for recording a view.
- `RecipeService.getById(id)` ([recipe.service.ts](../src/app/services/recipe.service.ts)
  line 49-51) is the only single-recipe fetch available; there is no
  multi-id variant.
- `IconComponent` ([icon.component.ts](../src/app/shared/icon/icon.component.ts))
  takes any ligature `name` string with no whitelist, so Material Symbols'
  `favorite`/`favorite_border` ligatures work with no component change.
- Existing action-row markup to match: `.recipe-card-actions` (grid,
  [recipe-list.component.html](../src/app/components/recipe-list/recipe-list.component.html)
  line 143), `.recipe-list-row-actions` (list, line 194), `.detail-actions`
  ([recipe-detail.component.html](../src/app/components/recipe-detail/recipe-detail.component.html)
  line 28) — all use `appButton`/`app-icon` the same way.
- No favorites, view-history, or any related concept exists anywhere in the
  frontend or backend today.

---

## Part 1 — Storage services

### Behavior

- `FavoritesService`: a set of favorited recipe ids, persisted under
  `localStorage` key `recipeFavorites` (JSON array). Toggling writes through
  immediately, same as `setViewMode`/`setSort`.
- `RecentlyViewedService`: an ordered, most-recent-first list of viewed
  recipe ids, persisted under key `recipeRecentlyViewed` (JSON array).
  Recording an id that's already present moves it to the front instead of
  duplicating it. Capped at a fixed `RECENT_LIMIT = 10` — recording an 11th
  id drops the oldest.
- Both services fall back to empty (`new Set()` / `[]`) if the stored value
  is missing, isn't valid JSON, or isn't the expected shape — the same
  defensive posture as `initialViewMode`/`initialSortKey` (invalid stored
  value → sane default, never a thrown error).
- These are real `@Injectable({ providedIn: 'root' })` services (not
  component-local module functions like `viewMode`) because, unlike view
  mode, favorite/recently-viewed state needs to be read and written from more
  than one component (list cards, list strips, detail page).

### Implementation

- New `services/favorites.service.ts`:
  - `favoriteIds = signal<ReadonlySet<number>>(this.readStorage())`.
  - `isFavorite(id: number): boolean` — plain method reading `favoriteIds()`,
    called directly per-recipe from templates (same shape as the existing
    `deleting() === recipe.id` per-row check).
  - `toggle(id: number): void` — builds a new `Set` (add or delete), calls
    `this.favoriteIds.set(next)`, then
    `localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))`.
  - `private readStorage(): ReadonlySet<number>` — `JSON.parse` in a
    try/catch, validates it's an array of numbers, else returns `new Set()`.
- New `services/recently-viewed.service.ts`:
  - `recentIds = signal<readonly number[]>(this.readStorage())`.
  - `record(id: number): void` — `[id, ...current.filter((x) => x !== id)].slice(0, RECENT_LIMIT)`,
    then write through.
  - `remove(id: number): void` — filters `id` out (used by Part 4 to prune a
    stale/deleted recipe from history without waiting for a new view to push
    it out via the cap).
  - Same `readStorage()` validation/fallback shape as `FavoritesService`.

### Files touched

- New `services/favorites.service.ts` + `.spec.ts`.
- New `services/recently-viewed.service.ts` + `.spec.ts`.

---

## Part 2 — Favorite toggle button on cards, rows, and detail page

### Behavior

- A heart icon-only button — `favorite` (filled) ligature when favorited,
  `favorite_border` (outline) otherwise — appears:
  - In `.recipe-card-actions` (grid cards) and `.recipe-list-row-actions`
    (list rows), alongside the existing Edit/Delete buttons.
  - In `.detail-actions` on `RecipeDetailComponent`, alongside Edit/Clone/
    Delete.
- Clicking toggles that recipe's favorite state immediately — no confirm
  dialog, no HTTP call, pure `localStorage` write — and the icon swaps in
  place.
- Because every consumer reads the same injected `FavoritesService.favoriteIds`
  signal, toggling a card's favorite on the list page is reflected
  instantly in that same page's "Favorites" strip (Part 4) with no reload.

### Implementation

- `RecipeListComponent`/`RecipeDetailComponent` add
  `protected readonly favoritesService = inject(FavoritesService);` and call
  `favoritesService.isFavorite(recipe.id)` / `favoritesService.toggle(recipe.id)`
  directly from templates — no wrapper methods, matching the existing
  minimal-indirection style already used for `resolveImageUrl`/`totalTimeMinutes`.
- Template: new button per action row —
  ```html
  <button
    type="button"
    appButton
    appearance="secondary"
    size="s"
    [iconOnly]="true"
    [attr.aria-pressed]="favoritesService.isFavorite(recipe.id)"
    [attr.aria-label]="favoritesService.isFavorite(recipe.id) ? 'Remove from favorites' : 'Add to favorites'"
    (click)="favoritesService.toggle(recipe.id)"
  >
    <app-icon [name]="favoritesService.isFavorite(recipe.id) ? 'favorite' : 'favorite_border'" [size]="14" />
  </button>
  ```
  (size `16` to match the detail page's existing icon sizing on that row).
- SCSS: no new class needed — the button reuses `appButton`/`app-icon`
  exactly like its neighbors; only a small color rule for the filled
  `favorite` state if the default icon color doesn't already read clearly
  against `appearance="secondary"`.

### Files touched

- [recipe-list.component.ts](../src/app/components/recipe-list/recipe-list.component.ts) / [.html](../src/app/components/recipe-list/recipe-list.component.html) (+ `.spec.ts`): inject `FavoritesService`, add the button to both action rows.
- [recipe-detail.component.ts](../src/app/components/recipe-detail/recipe-detail.component.ts) / [.html](../src/app/components/recipe-detail/recipe-detail.component.html) (+ `.spec.ts`): same, in `.detail-actions`.

---

## Part 3 — Recording a recently-viewed recipe on detail-page load

### Behavior

- Every time `RecipeDetailComponent` successfully loads a recipe (not on a
  404 or other error), its id is recorded via `RecentlyViewedService.record(id)`
  — including repeat visits, which just move it back to the front.

### Implementation

- `RecipeDetailComponent` injects `RecentlyViewedService`; in `ngOnInit`'s
  `next` handler (line ~103-107), add
  `this.recentlyViewedService.record(data.id);` alongside the existing
  `this.recipe.set(data)` and `this.scaleFactor.set(1)` — same insertion
  point `INGREDIENT_SCALING_SPEC.md` used, extended with one more line. The
  `error` handler is untouched, so a 404/failed load records nothing.

### Files touched

- [recipe-detail.component.ts](../src/app/components/recipe-detail/recipe-detail.component.ts) (+ `.spec.ts`): inject `RecentlyViewedService`, call `record()` in the success path only.

---

## Part 4 — "Recently viewed" and "Favorites" strips on the list page

### Behavior

- Two optional horizontal strips render on `RecipeListComponent`, above the
  existing `.recipe-list-toolbar`, each shown only when non-empty:
  "Recently viewed" (from `RecentlyViewedService.recentIds()`, most-recent
  first) and "Favorites" (from `FavoritesService.favoriteIds()`, in the
  `Set`'s insertion order).
- Each strip shows small cards — thumbnail (or the existing placeholder) and
  title only, linking to `/recipes/:id` — deliberately lighter than the main
  grid/list cards, since these are quick-jump shortcuts, not the primary
  browsing surface.
- The Favorites strip's mini-cards include the same heart toggle from Part 2,
  so un-favoriting is possible right from the strip. The Recently Viewed
  strip's mini-cards don't — that strip is passive history, not a
  curation surface — but it gets a small "Clear" text button that empties
  `RecentlyViewedService`'s history entirely.
- Both strips re-fetch automatically whenever their underlying id signal
  changes (e.g. toggling a favorite while on the list page updates the
  Favorites strip with no manual reload).
- If fetching a stored id 404s (the recipe was deleted since being
  favorited/viewed), that one result is dropped from the strip **and** the
  dead id is pruned from the underlying stored list, so it isn't re-fetched
  (and re-404s) on every future page load. One dead id doesn't affect the
  other results in the same strip.

### Implementation

- `RecipeListComponent` adds two new signals: `favoriteRecipes = signal<Recipe[]>([])`,
  `recentRecipes = signal<Recipe[]>([])`.
- A private helper mirroring the per-id fanout described in the intro:
  ```ts
  private fetchByIds(ids: number[]): Observable<Recipe[]> {
    if (ids.length === 0) return of([]);
    return forkJoin(
      ids.map((id) =>
        this.recipeService.getById(id).pipe(
          catchError(() => {
            this.pruneDeadId(id);
            return of(null);
          }),
        ),
      ),
    ).pipe(map((results) => results.filter((r): r is Recipe => r !== null)));
  }
  ```
  `forkJoin` preserves input order, so `ids` (already ordered by each
  service) doesn't need re-sorting after the fetch.
- Two `toObservable` pipelines in the constructor, alongside the existing
  `searchText` one (line 143-146):
  ```ts
  toObservable(this.favoritesService.favoriteIds)
    .pipe(
      switchMap((ids) => this.fetchByIds([...ids])),
      takeUntilDestroyed(this.destroyRef),
    )
    .subscribe((recipes) => this.favoriteRecipes.set(recipes));

  toObservable(this.recentlyViewedService.recentIds)
    .pipe(
      switchMap((ids) => this.fetchByIds([...ids])),
      takeUntilDestroyed(this.destroyRef),
    )
    .subscribe((recipes) => this.recentRecipes.set(recipes));
  ```
- `pruneDeadId(id: number)`: calls `this.favoritesService.toggle(id)` if it's
  currently favorited, and `this.recentlyViewedService.remove(id)` — safe to
  call both unconditionally since each is a no-op if the id isn't present in
  that particular store.
- `clearRecentlyViewed()`: thin wrapper the "Clear" button calls, which
  resets `RecentlyViewedService`'s stored list to empty (a `clear()` method
  added alongside `remove()` from Part 1).
- Template: two new `@if (list().length > 0) { <section class="recipe-strip">... }`
  blocks, each a `@for` over its recipes rendering a `.recipe-strip-card`
  (thumbnail via the existing `resolveImageUrl`/`.image-placeholder`
  fallback, title, `routerLink`). The Favorites strip's card additionally
  renders the Part 2 heart button as an absolutely-positioned overlay
  (sibling to the `<a>`, not nested inside it, so its own click doesn't
  trigger the link's navigation).
- SCSS: `.recipe-strip` (flex row, `overflow-x: auto`, matching the app's
  existing scrollable-row conventions), `.recipe-strip-card` (small
  thumb + title, reusing `.image-placeholder` sizing at the list-row scale).

### Files touched

- [recently-viewed.service.ts](../src/app/services/recently-viewed.service.ts) (+ `.spec.ts`): add `remove()` and `clear()`.
- [recipe-list.component.ts](../src/app/components/recipe-list/recipe-list.component.ts) / [.html](../src/app/components/recipe-list/recipe-list.component.html) / `.scss` (+ `.spec.ts`): the two strips, `fetchByIds`, `pruneDeadId`, `clearRecentlyViewed`, new signals and pipelines.

---

## Testing

- **`favorites.service.spec.ts`**: `toggle()` adds/removes from the set and
  writes through to `localStorage`; `isFavorite()` reflects current state;
  construction seeds from a pre-populated `localStorage` value; a
  missing/corrupt stored value falls back to an empty set without throwing.
- **`recently-viewed.service.spec.ts`**: `record()` unshifts a new id to the
  front; re-recording an already-present id moves it to the front without
  duplicating; recording an 11th id drops the oldest (`RECENT_LIMIT`);
  `remove()` drops one specific id; `clear()` empties the list; a
  missing/corrupt stored value falls back to `[]`.
- **`recipe-detail.component.spec.ts`**: a successful load calls
  `RecentlyViewedService.record()` with the loaded recipe's id; a 404/error
  load never calls `record()`; the favorite button reflects and updates
  `FavoritesService` state on click.
- **`recipe-list.component.spec.ts`**: both strips render only when
  non-empty; toggling a card's favorite button updates the Favorites strip
  without a manual reload; a stale id whose `getById()` 404s is dropped from
  the displayed strip and pruned from the underlying service's stored list;
  the "Clear" button empties the Recently Viewed strip and its backing
  storage.

---

## Suggested sequencing

1. **Part 1** — the two storage services and their tests. Fully testable in
   isolation, no component wiring.
2. **Part 3** — recording on detail-page load. Small, one insertion point,
   depends only on `RecentlyViewedService` from Part 1.
3. **Part 2** — the favorite toggle button on cards/rows/detail. Depends
   only on `FavoritesService` from Part 1; independent of Part 3.
4. **Part 4** — the list-page strips. Depends on both services, and is most
   useful to build/review once Parts 2-3 are already producing real
   favorite/recently-viewed data to display.

## Deferred

- A `GET /recipes?ids=...` bulk-fetch endpoint, removing the need for
  per-id `forkJoin` fanout in Part 4 — ruled out here because it's a backend
  change, which item 9 explicitly scopes out. Worth revisiting if the
  favorites/recently-viewed lists ever grow large enough that N parallel
  single-id requests becomes a real performance concern.
- Dedicated `/recipes/favorites` / `/recipes/recent` routes with their own
  pagination, if the strip format ever feels too cramped for someone with
  many favorites.
- Cross-device sync — would require the account/auth system tracked as
  `FUTURE_IDEAS.md` item 11 ("Bigger investments"), not started.
- Recording views from anywhere other than `RecipeDetailComponent`'s
  successful load (e.g. hovering a card in the list, opening the clone
  form).
