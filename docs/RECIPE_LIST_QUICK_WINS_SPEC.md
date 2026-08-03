# Recipe List Quick Wins: Search, Sort, Total Time, Duplication & State Polish

Design spec for the five "Quick wins" in [FUTURE_IDEAS.md](FUTURE_IDEAS.md):
search & tag filtering, sort controls, empty/error state polish, recipe
duplication, and total time display. Grouped into one spec because they're
small, mostly touch the same files, and were scoped together in the
backlog — each part can still ship independently. All operate purely
client-side over data `GET /recipes` already returns; no backend or
`openapi.yaml` change is needed for any part.

**Explicitly out of scope:** server-side search/filter/pagination
(`FUTURE_IDEAS.md` item 6 — only matters once recipe count outgrows a
single-payload fetch), image support, ingredient scaling, favorites, print
view, auth, and structured ingredients/steps — all separately tracked.

## Key decisions

- **Search/tag semantics:** case-insensitive substring match on
  title/description; tag chips use OR-within-tags, intersected with search
  text via AND. Purely a computed filter over the already-fetched
  `recipes()` signal — no new HTTP calls, no debounce needed (in-memory
  array scan, not a network request).
- **Sort persistence:** field + direction persist to `localStorage`
  following the exact precedent `viewMode` already set (seed from storage
  on init, write through on change) — new keys reuse that shape rather than
  a new mechanism. Nulls (`prepTimeMinutes`/`cookTimeMinutes`) always sort
  last regardless of direction.
- **Total time null-handling:** if both `prepTimeMinutes`/`cookTimeMinutes`
  are null, nothing renders (avoids implying "0 min"); if only one is set,
  the missing one counts as 0 in the sum — a deliberate judgment call, not
  a hard requirement.
- **Clone via router state, not a new route:** the source recipe is passed
  through `router.navigate(['/recipes/new'], { state: { cloneFrom: recipe } })`
  rather than a `/recipes/:id/clone` route or query-stringifying the
  recipe. Keeps `/recipes/new` as the single "create" route and avoids
  serializing a full Markdown `content` blob into a URL. The Clone button
  lives only in `RecipeDetailComponent`'s action row per the backlog item;
  a clone action on list cards/rows is an optional follow-on, not required.
- **Empty state for zero filtered results is distinct** from the
  "no recipes exist yet" state — different copy ("No recipes match your
  search." + Clear filters) since the fix is adjusting the filter, not
  adding data.

## Shape of the change

**Search & tag filtering:** a toolbar row in `RecipeListComponent` (search
input + toggleable tag chips, one per distinct tag across loaded recipes;
row doesn't render if no recipe has tags) drives `searchText`/`activeTags`
signals and a `filteredRecipes` computed that replaces `recipes()` in both
grid and list `@for` blocks and the empty-state check. `toggleTag()` builds
a new `Set` each call for signal-immutability consistency; `onSearchInput`
is a plain input handler, no `ReactiveFormsModule` needed for one field.

**Sort controls:** a `<select>` (Title/Prep/Cook/Created/Updated) plus a
direction toggle button, applied after filtering (`sortedRecipes` derives
from `filteredRecipes`, spread before `.sort()` since it mutates in place).
Clicking the same key flips direction; a new key resets direction to `asc`.

**Total time:** a shared pure helper,
`src/app/shared/recipe-time.util.ts` (`totalTimeMinutes()`), used from both
`RecipeListComponent` (cards/rows) and `RecipeDetailComponent`'s
`.detail-meta` line, rather than duplicating the null-handling rule.

**Clone:** `RecipeFormComponent.ngOnInit()` reads `history.state['cloneFrom']`
(survives past the initial navigation tick, unlike
`router.getCurrentNavigation()`) and `patchValue`s the form when present,
with title suffixed `" (Copy)"`; `id`/`createdAt`/`updatedAt` are never
copied. `isEdit`/`recipe` signals stay at create-mode defaults — a normal
POST via the existing `create()`, not a new service method.

**Empty/error state polish:** mostly a CSS/contrast audit of existing
`.empty-state` and `.notification-negative` banners (shared across list/
detail/form via one `_utilities.scss` class) in both themes and alongside
the new toolbar; the one new piece of logic is a "filtered to zero results"
branch (`recipes().length > 0 && sortedRecipes().length === 0`), kept
distinct from the "no recipes exist" branch, with a `clearFilters()` method
resetting `searchText`/`activeTags`.

Suggested sequencing: Parts 1→2→5 form a dependency chain in
`RecipeListComponent` (`filteredRecipes()` feeds `sortedRecipes()`, which
the "no matches" state depends on); Part 4 (clone) is independent, touching
`RecipeDetailComponent`/`RecipeFormComponent`; Part 3 (total time) is small
and logically independent but touches the same two template files as the
other tracks — see RECIPE_LIST_QUICK_WINS_IMPLEMENTATION_NOTES.md for how
this shaped subagent dispatch.

## Testing

Search/tag filtering (substring match, OR/AND semantics, clearing restores
full list); each sort key in both directions including null-last ordering,
and persistence across a simulated reload; `totalTimeMinutes()` unit-tested
directly for all three null combinations; cloning pre-fills the form and
submits via `create()` not `update()`; the "no matches" empty state renders
only when recipes exist but the filtered/sorted result is empty, and
`clearFilters()` restores the list.
