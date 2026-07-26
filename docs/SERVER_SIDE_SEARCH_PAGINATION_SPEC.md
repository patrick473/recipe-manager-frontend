# Server-Side Search, Filter & Pagination

Design spec for [FUTURE_IDEAS.md](FUTURE_IDEAS.md) item 6: moving `GET /recipes`
from "return every row" to a paginated, filterable, sortable endpoint, and
updating the frontend to drive its list page from that endpoint instead of an
in-memory scan over a fully-loaded array.

**Supersedes** `RECIPE_LIST_QUICK_WINS_SPEC.md` Parts 1–2 (client-side search/
tag-filter and sort): once the recipe count is large enough to matter, filtering
and sorting an array already sitting in the browser stops being the bottleneck
and the "fetch everything" call itself becomes the problem. This spec moves
that logic to the database. **Unaffected:** Quick Wins Part 3 (total time
display), Part 4 (clone), and Part 5 (empty/error state polish) — those work
the same regardless of where filtering happens, with one adjustment to Part 5
called out below.

**Explicitly out of scope for this pass:** infinite scroll / virtual scroll
(a classic "Prev/Next + page number" pager is enough for a first cut),
configurable page size in the UI (fixed at a sensible default), full-text
search ranking (substring `LIKE` matching is enough at this scale), and any
change to the write endpoints (`POST`/`PUT`/`DELETE` are untouched).

---

## Current state (baseline)

- `GET /recipes` ([RecipeController.java](../../recipe-manager-backend/src/main/java/com/example/recipemanager/controller/RecipeController.java)) takes no parameters and `RecipeService.findAll()` ([RecipeService.java](../../recipe-manager-backend/src/main/java/com/example/recipemanager/service/RecipeService.java)) calls `RecipeRepository.findAll()` — every row, every time, ordered by whatever the database returns for an unordered query (effectively insertion/id order).
- `RecipeRepository` ([RecipeRepository.java](../../recipe-manager-backend/src/main/java/com/example/recipemanager/repository/RecipeRepository.java)) is a bare `JpaRepository<Recipe, Long>` with no custom query methods and no `JpaSpecificationExecutor`.
- `Recipe` ([Recipe.java](../../recipe-manager-backend/src/main/java/com/example/recipemanager/model/Recipe.java)) stores `tags` as an `@ElementCollection` backed by a separate `recipe_tags` join table — a join, not a column, matters for how tag filtering has to be written.
- There is no test slice for the controller/service/repository today (only the default `RecipeManagerApplicationTests` context-load smoke test) — this spec is the first thing to introduce real backend test coverage for these classes.
- `RecipeService` (frontend, [recipe.service.ts](../src/app/services/recipe.service.ts)) exposes `getAll(): Observable<Recipe[]>` and a `recipeCount` signal set to `recipes.length` from that one response.
- `RecipeListComponent` ([recipe-list.component.ts](../src/app/components/recipe-list/recipe-list.component.ts)) loads the full array once in `ngOnInit()` and layers `filteredRecipes`/`sortedRecipes` computed signals on top (search text, tag `Set`, sort key/direction) — all pure in-memory array operations, per `RECIPE_LIST_QUICK_WINS_SPEC.md`. `viewMode`/`sortKey`/`sortDir` are seeded from and written through to `localStorage`.
- `orval.config.ts` generates `RecipesService`/model types from `openapi.yaml` — the frontend never hand-writes request/response shapes, so any endpoint contract change here means editing `openapi.yaml` and running `npm run api:generate` before touching `RecipeService`/`RecipeListComponent`.

---

## Part 1 — Backend: paginated, filterable, sortable query

### Behavior

- `GET /recipes` accepts five optional query parameters:
  - `q` — case-insensitive substring match against `title` OR `description`.
  - `tags` — comma-separated tag list, **OR** semantics among themselves (matches Quick Wins' existing frontend rule: a recipe matches if it has _any_ of the given tags), **AND**-ed with `q` if both are present.
  - `sort` — `field,dir` (e.g. `sort=title,asc`), where `field` is one of `title`, `prepTimeMinutes`, `cookTimeMinutes`, `createdAt`, `updatedAt`; default `title,asc`.
  - `page` — zero-based page index, default `0`.
  - `size` — page size, default `20`, capped at `100` (reject/clamp rather than let a client request the whole table back in one page, which would defeat the point of this spec).
- Response shape changes from a bare JSON array to an envelope: `content` (the page of `RecipeResponse` objects), plus `page`, `size`, `totalElements`, `totalPages`. **This is a breaking change** to `GET /recipes`'s response shape — there's exactly one consumer (this repo's own frontend), so it's coordinated in one PR rather than versioned.
- `prepTimeMinutes`/`cookTimeMinutes` sorting keeps Quick Wins' "nulls always sort last, regardless of direction" rule now enforced by the database instead of the client-side comparator.
- Empty `q`/`tags` behave as "no filter" (not "match nothing") — an empty query string is equivalent to omitting the parameter.

### Implementation

- `RecipeRepository extends JpaRepository<Recipe, Long>, JpaSpecificationExecutor<Recipe>` — adds `findAll(Specification<Recipe>, Pageable)` without hand-writing JPQL for every combination of filters.
- New `RecipeSpecifications` helper (`repository` package) with small composable static methods:
  - `titleOrDescriptionContains(String q)` — `criteriaBuilder.or(like(lower(title)), like(lower(description)))`.
  - `hasAnyTag(List<String> tags)` — a **correlated `EXISTS` subquery** against the `recipe_tags` join table (`SELECT 1 FROM recipe_tags rt WHERE rt.recipe_id = recipe.id AND rt.tag IN (:tags)`), not a `Root.join("tags")`. A direct join against an `@ElementCollection` combined with `Pageable` is a known JPA pitfall: the join multiplies rows per matching tag, and `DISTINCT` alongside `Pageable`/`ORDER BY` on a to-many join is exactly where Hibernate's in-memory-pagination warnings come from. The `EXISTS` subquery filters without ever widening the row set, so plain database-level `LIMIT`/`OFFSET` pagination stays correct. Tags themselves are still lazy-loaded per result row when serialized — fine at `size <= 100`, and a candidate for `@BatchSize`/`hibernate.default_batch_fetch_size` later if N+1 ever shows up in practice, not needed for this pass.
  - Combine both via `Specification.allOf(...)` (or `.and()` chaining), each only added when its input is non-blank/non-empty.
- `RecipeService.findAll(String q, List<String> tags, Pageable pageable)` replaces the no-arg `findAll()`: builds the `Specification`, calls `repository.findAll(spec, pageable)`, maps the returned `Page<Recipe>` to a new `RecipePageResponse` DTO (mirrors the existing `toResponse()` per-entity mapping, just wrapping a page instead of a bare list — no entities cross into the controller layer, same rule as every other method here).
- `Pageable` construction: a small controller-level helper builds `PageRequest.of(page, size, sort)` from the raw `sort` query param, translating `prepTimeMinutes`/`cookTimeMinutes` into `Sort.Order.by(field).with(dir).nullsLast()` (Hibernate emits `ORDER BY ... NULLS LAST`, supported by both H2 and PostgreSQL) and every other field into a plain `Sort.Order.by(field).with(dir)`. Reject unknown `field` values with a 400 (same `ProblemDetail` shape `GlobalExceptionHandler` already produces for validation failures) rather than silently ignoring them.
- New DTO `dto.RecipePageResponse` — `content: List<RecipeResponse>`, `page: int`, `size: int`, `totalElements: long`, `totalPages: int`. A hand-rolled DTO rather than serializing Spring Data's `Page<T>` directly, keeping the response contract fully described by `openapi.yaml` per this repo's existing entity/DTO-separation convention rather than depending on Spring Data's own JSON shape.
- `size` clamp: if `size > 100`, clamp to `100` rather than erroring — matches how other optional inputs in this API degrade already (e.g. nullable fields defaulting quietly).

### Files touched

- [RecipeController.java](../../recipe-manager-backend/src/main/java/com/example/recipemanager/controller/RecipeController.java): `listAll()` gains `@RequestParam` args for `q`, `tags`, `sort`, `page`, `size`; builds `Pageable`, delegates to the new `service.findAll(...)` overload.
- [RecipeService.java](../../recipe-manager-backend/src/main/java/com/example/recipemanager/service/RecipeService.java): new `findAll(String, List<String>, Pageable)` overload building the `Specification` and mapping to `RecipePageResponse`; old no-arg `findAll()` removed (nothing else calls it).
- [RecipeRepository.java](../../recipe-manager-backend/src/main/java/com/example/recipemanager/repository/RecipeRepository.java): add `JpaSpecificationExecutor<Recipe>`.
- New `repository/RecipeSpecifications.java`: `titleOrDescriptionContains()`, `hasAnyTag()`.
- New `dto/RecipePageResponse.java`.
- New test files (first backend test coverage beyond the smoke test): `RecipeRepositoryTest` (`@DataJpaTest`, exercises `RecipeSpecifications` against a real H2 instance — this is exactly the kind of query logic that's wrong in subtle ways if only unit-tested against mocks) and `RecipeControllerTest`/`RecipeServiceTest` for parameter parsing, clamping, and the 400-on-unknown-sort-field case.

---

## Part 2 — OpenAPI contract & client regeneration

### Behavior

- `openapi.yaml`'s `GET /recipes` operation gains five `parameters` entries (`q`, `tags` with `style: form, explode: false` for the comma-separated convention, `sort`, `page`, `size`, each with the defaults/caps from Part 1 documented in its `description`) and a new `400` response for the unknown-sort-field case.
- New `RecipePageResponse` schema under `components/schemas`, replacing the bare-array `200` response schema on `GET /recipes`.

### Implementation

- Edit `openapi.yaml` first, then run `npm run api:generate` (per `CLAUDE.md`'s cross-repo contract rule) — this regenerates `src/app/api/generated/recipes/recipes.service.ts`'s `listRecipes()` signature (now taking a params object) and adds the `RecipePageResponse` model under `src/app/api/generated/model/`.
- `src/app/models/recipe.model.ts` gets a matching re-export, `export type { RecipePageResponse } from '../api/generated/model';`, alongside the existing `Recipe`/`RecipeRequest` re-exports — consuming code keeps importing from `models/recipe.model`, never the generated path directly, per existing convention.

### Files touched

- [openapi.yaml](../../recipe-manager-backend/openapi.yaml)
- `src/app/api/generated/**` (regenerated, not hand-edited)
- [recipe.model.ts](../src/app/models/recipe.model.ts): add the `RecipePageResponse` re-export

---

## Part 3 — Frontend: `RecipeService` and `RecipeListComponent`

### Behavior

- The list page keeps the same toolbar (search input, tag chips, sort select + direction button) Quick Wins already built — only what happens _after_ a change fires is different: instead of recomputing a local `computed()`, the component debounces and issues a new `GET /recipes` request.
- Search input is debounced **300ms** (it's a network call now, not an in-memory scan — Quick Wins explicitly called out "no debounce needed" for the old array-scan version; that reasoning no longer holds).
- Tag-chip toggles, sort-key/direction changes, and page navigation trigger an immediate refetch (no debounce — these are discrete clicks, not a stream of keystrokes).
- A pager appears below the list: "Prev" / "Next" buttons plus "Page X of Y" (from `RecipePageResponse.page`/`totalPages`), disabled appropriately at the first/last page. Changing any filter or sort resets to page 0 (staying on, say, page 4 of a search that now only has 2 pages would just show an empty page, which is confusing).
- `q`, `tags`, `sort`, `sortDir`, and `page` are reflected into the route's query params (`/recipes?q=...&tags=...&sort=...&page=...`) so a reload or shared link reproduces the same view — this is new: Quick Wins' `sortKey`/`sortDir`/`viewMode` stay exactly as they are today, persisted to `localStorage` as a standing user preference, while `q`/`tags`/`page` are per-visit/session state that belongs in the URL, not a returning-user default (nobody wants their search text from three days ago silently re-applied on their next visit). On load, the URL's query params seed the initial request; `localStorage` still seeds `viewMode`/initial `sort`/`sortDir` exactly as before, overridden by the URL if the URL has its own `sort` param.
- Availability of tag chips (`availableTags`) can no longer be derived from "every loaded recipe" (the frontend never has every recipe in memory anymore). Simplest option that needs no backend change: keep the currently-known tag set sticky — i.e. `availableTags` accumulates the union of tags seen across pages/responses fetched so far in this session, rather than resetting per request. This means brand-new tags on recipes that haven't been fetched yet won't appear as a filter chip until a search/page surfaces them — an acceptable rough edge for a first cut, worth a one-line code comment explaining why (surprising otherwise), not worth a dedicated `/recipes/tags` endpoint in this pass.
- Quick Wins Part 5's "no recipes at all" vs. "no recipes match the filter" empty-state distinction can no longer be answered by comparing a full in-memory array's length before and after filtering (there is no full in-memory array). Reframe the check on _whether a filter is currently active_ instead of _whether the database is empty_: if `q`/`tags` are both empty and the page comes back with zero content, show the existing "no recipes yet" CTA; if `q`/`tags` are non-empty and the page is empty, show "no recipes match your search" + "Clear filters". This is a strictly simpler condition than before (no need to compare two arrays) and produces the same user-visible behavior in every case that matters.

### Implementation

- `RecipeService.getAll(params: { q?: string; tags?: string[]; sort?: string; page?: number; size?: number }): Observable<RecipePageResponse>` replaces the no-arg `getAll()`, passing `params` straight through to the regenerated `RecipesService.listRecipes(params)`.
- `recipeCount` signal now set from `response.totalElements` (total matching rows across all pages), not `response.content.length` (current page size) — `hasRecipes` keeps its existing meaning ("does at least one matching recipe exist"), it just now reads the right number.
- `RecipeListComponent`: delete `filteredRecipes`/`sortedRecipes` computed signals and the local `sortValue`/`compareRecipes` comparator functions entirely (dead code once the server does this) — `recipes` signal now holds exactly the current page's `content`, no client-side derivation on top of it.
- Add `page = signal<number>(initialPage())` and a `totalPages = signal(1)` (or a `pageInfo` signal holding `{ page, totalPages, totalElements }` set alongside `recipes` in the same response handler) — `initialPage()` mirrors the existing `initialViewMode()`/`initialSortKey()` module-level-function pattern, reading from `ActivatedRoute` query params instead of `localStorage` for this one.
- Debounce: convert `searchText` into an RxJS stream via `toObservable(this.searchText)`, `.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())`, subscribing to call `loadRecipes()`. Direct signal `.set()` calls from tag/sort/page handlers call `loadRecipes()` synchronously afterward (no debounce needed there).
- `loadRecipes()` now builds its params from the current `searchText()`/`activeTags()`/`sortKey()`/`sortDir()`/`page()` signals, calls `recipeService.getAll(...)`, sets `recipes`/`pageInfo` from the response, and — new — updates the route's query params via `router.navigate([], { queryParams: {...}, queryParamsHandling: 'merge' })` so the URL stays in sync without adding a history entry per keystroke (`replaceUrl: true`).
- `availableTags` becomes a plain `signal<ReadonlySet<string>>(new Set())` updated by merging each response's tags in, rather than a `computed()` over `recipes()` (the computed version silently loses tags once earlier pages scroll out of the current `recipes()` window).
- Pager markup: two buttons (`appButton appearance="secondary"`, reusing the existing directive per established convention) plus a "Page {{ page() + 1 }} of {{ totalPages() }}" label; `nextPage()`/`prevPage()` bump `page` and call `loadRecipes()`.

### Files touched

- [recipe.service.ts](../src/app/services/recipe.service.ts) / [recipe.service.spec.ts](../src/app/services/recipe.service.spec.ts): `getAll()` signature and `recipeCount` source change.
- [recipe-list.component.ts](../src/app/components/recipe-list/recipe-list.component.ts): remove client-side filter/sort computeds and comparator helpers; add debounced search stream, `page`/`pageInfo` signals, query-param sync, revised `availableTags`.
- [recipe-list.component.html](../src/app/components/recipe-list/recipe-list.component.html): pager markup; revised empty-state condition per the behavior above.
- [recipe-list.component.spec.ts](../src/app/components/recipe-list/recipe-list.component.spec.ts): rewritten per "Testing" below — most existing Quick Wins filter/sort specs move to the backend test suite instead.

---

## Testing

- **Backend** (new coverage — see Part 1's "Files touched"):
  - `RecipeSpecifications`/repository-level: `q` matches title-only, description-only, and neither; case-insensitivity; `tags` OR-matches across multiple tags without returning duplicate rows for a recipe matching more than one requested tag; `q` AND `tags` combined; empty/absent `q`/`tags` return everything.
  - Pagination: `totalElements`/`totalPages` are correct against a seeded multi-page dataset; `page`/`size` bounds (page past the last page returns empty `content`, not an error; `size` above 100 clamps rather than 500s).
  - Sorting: each allowed `field` sorts correctly both directions; `prepTimeMinutes`/`cookTimeMinutes` nulls sort last in both directions (this is the same rule Quick Wins unit-tested client-side — now it needs a database-level test instead); unknown `field` returns 400 with the existing `ProblemDetail` shape.
- **Frontend**:
  - `RecipeService.getAll()` passes params through correctly and sets `recipeCount` from `totalElements`.
  - `RecipeListComponent`: search input debounces (fake timers / `fakeAsync` + `tick(300)`) before triggering a request; tag toggle and sort change trigger an immediate request without waiting for the debounce; page buttons disabled at first/last page and call `loadRecipes()` with the right `page` value; changing a filter resets `page` to 0.
  - Empty-state branch: "no recipes yet" renders when `q`/`tags` are empty and `content` is empty; "no matches" + "Clear filters" renders when a filter is active and `content` is empty; `clearFilters()` resets `q`/`tags`/`page` and refetches.
  - Query-param sync: setting search/tag/sort/page updates the route's query params; loading the component with query params already present (simulating a reload) seeds `searchText`/`activeTags`/`sortKey`/`sortDir`/`page` from them.

---

## Suggested sequencing

1. **Part 1** (backend) — land and test the `Specification`/`Pageable` query support entirely behind the existing response shape isn't possible (the shape change is inherent to the feature), so land Part 1 and Part 2 together in practice; sequenced separately here only to describe them as distinct concerns.
2. **Part 2** (OpenAPI + client regen) — immediately after Part 1, in the same PR: update `openapi.yaml`, run `npm run api:generate`, confirm the generated client compiles before touching any consuming frontend code.
3. **Part 3** (frontend integration) — last: swap `RecipeListComponent` over to the new paginated `getAll()`, remove the now-dead client-side filter/sort code, add the pager and query-param sync.
4. Follow-up, deliberately deferred: a dedicated "distinct tags across all recipes" endpoint (would fix the "unseen tags don't appear as filter chips" rough edge from Part 3), configurable page size in the UI, and revisiting `@BatchSize`/`default_batch_fetch_size` if tag N+1 queries show up in real usage.
