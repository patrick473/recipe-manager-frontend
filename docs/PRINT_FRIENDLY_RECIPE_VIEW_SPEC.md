# Print-Friendly Recipe View & Printing

Design spec for [FUTURE_IDEAS.md](FUTURE_IDEAS.md) item 10: "a `@media
print` stylesheet for `RecipeDetailComponent`." This spec extends that
framing slightly: the request that produced this doc explicitly asked for
"print functionality," not just a passive stylesheet — so on top of the
`@media print` rules, a visible **Print** button is added to the detail
page's action row. Relying only on the browser's Ctrl/Cmd+P shortcut is fine
for a power user, but this is a recipe app someone may be using standing at
a stove; a discoverable button is worth the small extra surface area over a
"just press Ctrl+P" stylesheet-only approach.

**Explicitly out of scope:**

- Any backend or `openapi.yaml` change — pure frontend CSS/DOM, no new data.
- A distinct "Export as PDF" feature — the browser's print dialog already
  offers "Save as PDF"; a separate export path is `FUTURE_IDEAS.md` item 13.
- Printing more than one recipe at a time (batch/shopping-list print) — item
  10 is framed around `RecipeDetailComponent` specifically.
- A dedicated print-preview route — reuses `RecipeDetailComponent`'s
  existing DOM, styled differently via `@media print`; no new route/component.
- Restoring the properties panel's collapsed/expanded state after printing
  (e.g. via `afterprint`) — printing force-expands it and leaves it expanded.
- The browser's own print header/footer (URL, date, page numbers) — controlled
  by browser print-settings UI, not page CSS.
- Print styling for `RecipeFormComponent` or other routes — only
  `RecipeDetailComponent` gets page-specific print styles; the global reset
  (hiding nav, forcing light colors) applies app-wide, deliberately.

## Shape of the change

A new global `_print.scss` (`@use`d from `styles.scss`) forces the light
color palette under `@media print` even when `data-theme="dark"` is set
(paper should never carry the dark theme's near-black background), sets a
tighter `@page` margin than a typical document default, and hides
`app-nav-bar`, `app-confirm-dialog`, `.notification`, and `app-loader` on
every route — transient/chrome UI with no value on a printed page.

`RecipeDetailComponent` gets component-scoped print styles: the breadcrumb
nav, the action row, and the scale-control buttons are hidden (the
_quantities_ they produced stay — `INGREDIENT_SCALING_SPEC.md`'s Part 1
already bakes scaled quantities into `renderedContent()`); `.detail-card`'s
card chrome (background/border/shadow/padding) is stripped so the recipe
reads as a plain document, targeted via the `.detail-card` class
specifically (not the shared `.card-lg` utility also used by
`RecipeFormComponent`) so the form page is unaffected; the hero image gets
`break-inside: avoid`. `PropertiesPanelComponent` hides its chevron under
print (still-expanded panel reads as a plain section heading, not an
implied-interactive control).

The Print button sits in `.detail-actions` between Favorite and Delete.
`PropertiesPanelComponent.expanded` is a signal with no existing
input/output to control it externally, and its template removes
`.properties-body` from the DOM entirely when collapsed (not just
CSS-hidden) — so a `@media print` rule alone can't force it back into view.
A new public `expand()` method is added for `RecipeDetailComponent` to call
via a `viewChild` reference before printing; `printRecipe()` calls
`expand()` then defers `window.print()` with a `setTimeout` since signal
writes don't repaint synchronously within an OnPush component's event
handler. If the panel was already expanded, nothing extra happens before
the dialog opens. After printing, the panel stays expanded (see out-of-scope).

Suggested sequencing (Part 1: global reset → Part 2: component print styles,
depends on Part 1 → Part 3: Print button, most useful once 1-2 make the
print output it triggers look right) was followed strictly sequentially —
see PRINT_FRIENDLY_RECIPE_VIEW_IMPLEMENTATION_NOTES.md.

## Testing

Unit: `expand()` un-collapses the panel; clicking Print calls
`PropertiesPanelComponent.expand()` and `window.print()` (both spied).
New Playwright e2e (`recipe-print.spec.ts`) — the only place that can
actually verify `@media print` CSS: `page.emulateMedia({ media: 'print' })`
asserts nav/actions/breadcrumbs hidden while title/body stay visible; a
collapsed-panel-then-Print flow (with `window.print` stubbed) asserts the
properties body becomes visible.

## Deferred

- A dedicated print-preview route or in-app preview pane.
- Restoring the properties panel's prior collapsed state after printing via
  `afterprint` — left expanded deliberately, to keep this pass small.
- A "print multiple / print shopping list" batch flow — `FUTURE_IDEAS.md`
  item 14 territory.
- PDF export as a first-class feature — `FUTURE_IDEAS.md` item 13.
