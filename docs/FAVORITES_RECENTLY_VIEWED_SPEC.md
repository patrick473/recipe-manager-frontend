# Favorites & Recently Viewed

Spec for [FUTURE_IDEAS.md](FUTURE_IDEAS.md) item 9: localStorage-backed, no
backend change, built on the existing signals pattern.

**Key decisions:**

- **No backend/`openapi.yaml` change**, including no bulk
  `GET /recipes?ids=...` endpoint — even though `RecipeListComponent` no
  longer holds every recipe in memory since server-side pagination shipped
  (`SERVER_SIDE_SEARCH_PAGINATION_SPEC.md`). Favorite/recently-viewed ids
  are fetched individually via the existing `getById()`, fanned out with
  `forkJoin`. Deliberate tradeoff to stay a "no backend change" feature; see
  Deferred.
- **No new routes** — favorites and recently-viewed are two optional
  strips on the existing `/recipes` list page, not dedicated pages.
- Real `@Injectable({ providedIn: 'root' })` services (`FavoritesService`,
  `RecentlyViewedService`), not component-local module functions like the
  existing `viewMode` pattern — this state needs to be read/written from
  more than one component.

**Out of scope:** any backend change, cross-device sync (localStorage is
per-browser, same as `viewMode`), dedicated favorites/recent routes, any
effect on the main paginated list's query params, configurable history
size (fixed `RECENT_LIMIT = 10`), bulk "clear all favorites" (un-favoriting
is a single heart-click), recording views from anywhere but
`RecipeDetailComponent`'s successful load.

## Shape of the change

- **`FavoritesService`**: `Set<number>` in `localStorage` key
  `recipeFavorites`; `toggle()`/`isFavorite()`, write-through immediately.
- **`RecentlyViewedService`**: most-recent-first `number[]` in key
  `recipeRecentlyViewed`; `record()` moves an existing id to front rather
  than duplicating, caps at 10 (drops oldest); `remove()`/`clear()` for
  pruning.
- Both fall back to empty on missing/invalid stored JSON, matching the
  existing `viewMode`/`sortKey` defensive pattern.
- A heart icon-only button (`favorite`/`favorite_border` ligatures) in the
  card/row action rows and on the detail page, toggling instantly with no
  confirm dialog and no HTTP call.
- `RecipeDetailComponent` records a view in its existing `ngOnInit` success
  handler (not on 404/error).
- Two horizontal strips ("Recently viewed", "Favorites") above the list
  page's toolbar, shown only when non-empty, each re-fetching via a
  `toObservable(idsSignal).pipe(switchMap(fetchByIds))` pipeline so they
  update live as ids change elsewhere on the page. Favorites strip cards
  include the heart toggle; Recently Viewed cards don't (passive history)
  but the strip has a "Clear" button. A 404 on a stored id drops it from
  the strip **and** prunes it from the underlying store so it isn't
  re-fetched every load.

## Testing

Storage-service unit tests (toggle/record/cap/remove/clear, corrupt-storage
fallback); detail-component test asserting `record()` fires only on
success; list-component tests for strip visibility, live update on
favorite-toggle, dead-id pruning, and the Clear button.

## Deferred

A bulk `GET /recipes?ids=...` endpoint if per-id fanout ever becomes a real
perf concern; dedicated favorites/recent routes with their own pagination;
cross-device sync (needs the auth system, item 11); recording views from
anywhere besides the detail page.
