# Future Ideas

A running backlog of potential next features for the Recipe Manager, roughly
ordered by size/effort within each tier. Not commitments — just candidates to
pull from when picking up new work.

## Quick wins (small, high value)

1. **Search & tag filtering (list page)** — client-side filter box + tag
   chips on `RecipeListComponent`; no backend change needed since `getAll()`
   already returns everything.
2. **Sort controls** — by title, prep/cook time, created/updated date
   (currently always ascending by id).
3. **Empty/error state polish** — check the `@empty` block styling and the
   "backend not running" error state look decent in both grid/list views.
4. **Recipe duplication** — "Clone recipe" button on detail view, pre-fills
   the form for a new POST.
5. **Total time display** — surface `prepTimeMinutes + cookTimeMinutes` as
   "Total: X min" on cards/detail.

## Medium features

6. **Server-side search/filter/pagination** — add
   `GET /recipes?q=&tag=&page=&size=` to `RecipeController`/
   `RecipeRepository` (Spring Data `Specification` or derived query
   methods), update `openapi.yaml`, regenerate the client. Matters once
   recipe count grows beyond what's comfortable to ship to the browser in
   one payload.
7. **Image support** — add an `imageUrl` (or upload) field to
   `Recipe`/DTOs, show a thumbnail in the list and hero image on detail.
8. **Ingredient scaling** — parse quantities out of the Markdown `content`
   (or model ingredients as structured data instead of freeform Markdown)
   so servings can be scaled up/down.
9. **Favorites / recently viewed** — localStorage-backed, no backend change,
   quick to build on top of the existing signals pattern.
10. **Print-friendly recipe view** — a `@media print` stylesheet for
    `RecipeDetailComponent`.

## Bigger investments

11. **Authentication & per-user recipes** — currently fully open; add
    Spring Security + JWT, scope recipes to a `userId`, add login/register
    on the frontend. Biggest architectural change on the list.
12. **Structured ingredients & steps** — replace/augment the single
    Markdown `content` blob with real `Ingredient`/`Step` entities,
    enabling scaling, shopping-list export, and step-by-step "cook mode."
13. **Import/export** — export a recipe as Markdown/JSON/PDF; import from a
    URL (recipe scraping) or a pasted Markdown file.
14. **Meal planning / shopping list** — a weekly planner that aggregates
    ingredients across selected recipes into a shopping list.
15. **PostgreSQL profile config** — Postgres is already supported via
    datasource properties per the root `CLAUDE.md`, but there's no
    `application-prod.properties`; worth adding a real Spring profile so
    prod switching isn't manual.
