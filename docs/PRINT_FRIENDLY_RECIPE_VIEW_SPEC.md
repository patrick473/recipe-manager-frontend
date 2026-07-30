# Print-Friendly Recipe View & Printing

Design spec for [FUTURE_IDEAS.md](FUTURE_IDEAS.md) item 10: "a `@media
print` stylesheet for `RecipeDetailComponent`." This spec extends that
framing slightly: the request that produced this doc explicitly asked for
"print functionality," not just a passive stylesheet — so on top of the
`@media print` rules, Part 3 adds a visible **Print** button to the detail
page's action row. Relying only on the browser's Ctrl/Cmd+P shortcut is fine
for a power user, but this is a recipe app someone may be using standing at
a stove; a discoverable button is worth the small extra surface area over a
"just press Ctrl+P, it'll look right" stylesheet-only approach.

**Explicitly out of scope for this pass:**

- Any backend or `openapi.yaml` change — this is pure frontend CSS/DOM, no
  new data.
- A distinct "Export as PDF" feature. The browser's print dialog already
  offers "Save as PDF" as a destination once the page prints cleanly; a
  separate export path is `FUTURE_IDEAS.md` item 13 (Import/export), not
  this one.
- Printing more than one recipe at a time (a shopping-list-style batch
  print). Item 10 is framed around `RecipeDetailComponent` specifically —
  one recipe per print job.
- A dedicated print-preview route (e.g. `/recipes/:id/print`) rendering a
  separate lightweight template. This spec reuses
  `RecipeDetailComponent`'s existing DOM entirely, styled differently via
  `@media print` — no new route, no new component.
- Restoring the properties panel's collapsed/expanded state after printing
  (e.g. via the `afterprint` event). Printing force-expands it (Part 3) and
  leaves it expanded afterward; it does not snap back to whatever state it
  was in before the user clicked Print.
- The browser's own print header/footer (URL, date, page title/numbers) —
  that's controlled by the browser's print-settings UI, not by page CSS,
  and isn't something this spec attempts to override.
- Any change to `RecipeFormComponent` or other routes' printing — only
  `RecipeDetailComponent` gets page-specific print styles (Part 2); the
  global reset in Part 1 (hiding nav, forcing light colors) applies
  app-wide, which is a deliberate exception — see Part 1.

---

## Current state (baseline)

- No `@media print` rule exists anywhere in the codebase today (confirmed —
  zero matches across `src/`).
- `RecipeDetailComponent`'s template
  ([recipe-detail.component.html](../src/app/components/recipe-detail/recipe-detail.component.html)):
  a `.breadcrumbs` nav, a `.detail-actions` row (Edit / Clone / Favorite /
  Delete buttons), then a `.card-lg detail-card` (line 67) containing the
  hero image, title, description, `.detail-meta` (created/updated/total
  time), a divider, `<app-properties-panel>`, the `.scale-control` (only
  when `canScale()`), and finally `.markdown-body` with the rendered
  recipe content.
- `.card-lg` ([_utilities.scss](../src/styles/_utilities.scss) line 15) is a
  shared utility class also used by `RecipeFormComponent`
  ([recipe-form.component.html](../src/app/components/recipe-form/recipe-form.component.html)
  line 22) for its card chrome (background/border/shadow/padding). Print
  styles that strip that chrome must target `.detail-card` specifically
  (the extra class already on that one element, recipe-detail.component.html
  line 67), not the shared `.card-lg` class, so the form page's print
  appearance is untouched.
- `PropertiesPanelComponent`
  ([properties-panel.component.ts](../src/app/shared/properties-panel/properties-panel.component.ts)):
  `expanded = signal(true)` (line 38) is purely internal — no input/output
  exists to read or set it from outside. Its template
  ([properties-panel.component.html](../src/app/shared/properties-panel/properties-panel.component.html)
  line 12) gates `.properties-body` behind `@if (expanded() && ...)`, so a
  collapsed panel has its tags/times/servings **removed from the DOM
  entirely**, not just visually hidden — a `@media print` rule alone cannot
  force it back into view if the user collapsed it before printing. This is
  the reason Part 3 needs a real method call, not just CSS.
- `IconComponent` ([icon.component.html](../src/app/shared/icon/icon.component.html))
  renders a `material-icons` ligature `<span aria-hidden="true">` — purely
  decorative, self-hosted via the `material-icons` npm package
  ([angular.json](../angular.json) line 44), not a remote font request. A
  `print` ligature exists in that font
  (`node_modules/material-icons/css/_codepoints.scss`), so the new button
  in Part 3 can use `<app-icon name="print" />` like its neighbors.
- Theming: [_tokens.scss](../src/styles/_tokens.scss) defines the color
  palette as CSS custom properties on `:root` (light, lines 1-57) with a
  `:root[data-theme='dark']` override block (lines 59-82) toggled by
  `NavBarComponent`'s theme toggle. Printing a dark-themed page as-is would
  send a near-black `--color-bg` (`#10150c`) and light-on-dark text to the
  printer — wasteful and wrong for paper, so Part 1 forces the light values
  regardless of the current `data-theme`.
- Layout chrome: `.side-nav` lives in `nav-bar.component.scss`
  ([nav-bar.component.scss](../src/app/components/nav-bar/nav-bar.component.scss))
  and `<app-confirm-dialog />` sits alongside `<router-outlet>` in
  [app.component.html](../src/app/app.component.html). Angular's emulated
  view encapsulation only scopes a component's _own_ stylesheet rules to
  that component's template — it does not stop a global, non-component
  stylesheet from selecting those same elements by tag/class from outside.
  So hiding `.side-nav`/`app-confirm-dialog` from a new global stylesheet
  (Part 1) works with no change to `nav-bar.component.scss` itself.
- `.notification`/`.notification-negative` and `app-loader` are shared,
  global-utility-backed elements ([_utilities.scss](../src/styles/_utilities.scss)
  lines 106-117) used for the error/loading/`imageUploadFailed` banners on
  this same page — transient UI state with no value on a printed page.

---

## Part 1 — Global print reset

### Behavior

- Printing any page in the app renders in the light color palette, never
  dark — regardless of the current theme toggle state.
- The side nav (`app-nav-bar`) and the confirm-dialog host
  (`app-confirm-dialog`) never appear in print output, on any route.
- Status banners (`.notification`, `.notification-negative`) and the
  `app-loader` spinner never appear in print output, on any route — these
  are transient UI, not printable content.
- The printed page uses a slightly tighter page margin than a typical
  document default, since recipe content (ingredient lists, numbered steps)
  reads fine dense.

### Implementation

- New `src/styles/_print.scss`:

  ```scss
  @media print {
    @page {
      margin: 1.5cm;
    }

    // Force the light palette even when data-theme="dark" is set — printed
    // paper should never carry the dark theme's near-black background.
    :root,
    :root[data-theme='dark'] {
      color-scheme: light;
      --color-bg: #f6f9f1;
      --color-surface: #ffffff;
      --color-surface-hover: #edf4e6;
      --color-border: #dbe6d0;
      --color-text: #1e2a17;
      --color-text-muted: #66755c;
      --color-primary: #4a8f3c;
    }

    app-nav-bar,
    app-confirm-dialog,
    .notification,
    app-loader {
      display: none !important;
    }
  }
  ```

  The `:root[data-theme='dark']` override here has the same selector
  specificity as `_tokens.scss`'s own dark-mode block, so ordering decides
  the winner — `_print.scss` is `@use`d after `styles/tokens` (see below),
  so it wins.

- [styles.scss](../src/styles.scss): add `@use 'styles/print';` after the
  existing `@use` lines.

### Files touched

- New `src/styles/_print.scss`.
- [styles.scss](../src/styles.scss): one new `@use` line.

---

## Part 2 — `RecipeDetailComponent` print styles

### Behavior

- Printed output shows: the hero image, title, description, meta line
  (created/updated/total time), the properties panel (tags/prep/cook time/
  servings — forced expanded by Part 3), and the full rendered recipe body
  — at whatever ingredient scale factor was selected on screen (Part 1 of
  `INGREDIENT_SCALING_SPEC.md` already bakes the scaled quantities into
  `renderedContent()`, so no extra work is needed here to print the scaled
  numbers rather than the recipe's original ones).
- Printed output hides: the breadcrumb nav, the Edit/Clone/Favorite/Print/
  Delete action row, and the scale-control buttons themselves (the
  _quantities_ they produced stay, per above — only the interactive
  stepper/multiplier buttons disappear).
- The card chrome (`.detail-card`'s background/border/shadow/padding) is
  stripped in print so the recipe reads as a plain document rather than a
  screenshot of a UI panel — flush with the page margin set in Part 1
  instead of floating in a bordered box.
- The hero image doesn't get split across a page break.

### Implementation

- [recipe-detail.component.scss](../src/app/components/recipe-detail/recipe-detail.component.scss):
  append

  ```scss
  @media print {
    :host {
      padding: 0;
    }

    .breadcrumbs,
    .detail-actions,
    .scale-control {
      display: none !important;
    }

    .detail-card {
      background: none;
      border: none;
      box-shadow: none;
      padding: 0;
    }

    .detail-hero {
      break-inside: avoid;
    }
  }
  ```

  (`.breadcrumbs` here is the shared utility class scoped by Angular's
  emulated encapsulation to this component's own template usage of it —
  safe to target from this component's own stylesheet without affecting
  other routes' breadcrumbs.)

- [properties-panel.component.scss](../src/app/shared/properties-panel/properties-panel.component.scss):
  append

  ```scss
  @media print {
    .chevron {
      display: none;
    }
  }
  ```

  so the (now permanently-expanded, per Part 3) toggle header doesn't show
  a collapse arrow that implies interactivity paper doesn't have. The
  "Properties" label itself stays, reading as a plain section heading.

### Files touched

- [recipe-detail.component.scss](../src/app/components/recipe-detail/recipe-detail.component.scss).
- [properties-panel.component.scss](../src/app/shared/properties-panel/properties-panel.component.scss).

---

## Part 3 — Print button + force-expanding the properties panel

### Behavior

- A new "Print" button sits in `.detail-actions`, between Favorite and
  Delete (icon `print`, `appearance="secondary"` like Edit/Clone/Favorite —
  Delete stays the last, destructive-styled action).
- Clicking it: if the properties panel is currently collapsed, it's
  expanded first (so tags/prep/cook/servings are present for Part 2's print
  styles to show); the browser's print dialog then opens via
  `window.print()`.
- If the panel was already expanded, clicking Print does nothing extra
  before opening the dialog.
- After printing, the panel is left expanded (see "Explicitly out of scope"
  — no restore-previous-state behavior).

### Implementation

- [properties-panel.component.ts](../src/app/shared/properties-panel/properties-panel.component.ts):
  add one public method alongside the existing `protected toggleExpanded()`
  (line 59):

  ```ts
  /** Forces the panel open — used by RecipeDetailComponent before printing. */
  expand(): void {
    this.expanded.set(true);
  }
  ```

- [recipe-detail.component.ts](../src/app/components/recipe-detail/recipe-detail.component.ts):
  - `protected readonly propertiesPanel = viewChild(PropertiesPanelComponent);`
    (signal-based `viewChild`, matching this file's existing signal style —
    import from `@angular/core` alongside `computed`/`signal`).
  - New method:

    ```ts
    protected printRecipe(): void {
      this.propertiesPanel()?.expand();
      // Let Angular flush the (OnPush) DOM update for the now-expanded
      // properties body before the browser snapshots the page to print —
      // signal writes don't repaint synchronously within this handler.
      setTimeout(() => window.print());
    }
    ```

- [recipe-detail.component.html](../src/app/components/recipe-detail/recipe-detail.component.html):
  new button in `.detail-actions`, after the Favorite button (line ~53) and
  before Delete:

  ```html
  <button type="button" appButton appearance="secondary" (click)="printRecipe()">
    <app-icon name="print" [size]="16" />
    Print
  </button>
  ```

### Files touched

- [properties-panel.component.ts](../src/app/shared/properties-panel/properties-panel.component.ts)
  (+ `.spec.ts`): new `expand()` method.
- [recipe-detail.component.ts](../src/app/components/recipe-detail/recipe-detail.component.ts)
  / [.html](../src/app/components/recipe-detail/recipe-detail.component.html)
  (+ `.spec.ts`): `propertiesPanel` view child, `printRecipe()`, the button.

---

## Testing

- **`properties-panel.component.spec.ts`**: `expand()` sets `expanded` to
  `true` and makes `.properties-body` present even when the panel started
  collapsed.
- **`recipe-detail.component.spec.ts`**: clicking Print calls
  `PropertiesPanelComponent.expand()` on the view child and calls
  `window.print()` (both spied); use `fakeAsync`/`tick()` to flush the
  `setTimeout` before asserting `window.print` was called.
- **New `e2e/tests/recipe-print.spec.ts`** (Playwright) — the one place
  that can actually verify the CSS, since Vitest/jsdom unit tests can't
  evaluate `@media print` rendering:
  - `page.emulateMedia({ media: 'print' })` on a recipe detail page, then
    assert `.side-nav`, `.detail-actions`, and `.breadcrumbs` are hidden
    (`toBeHidden()`) while the recipe title and `.markdown-body` content
    remain visible.
  - Load the page with the properties panel collapsed (click its toggle),
    click Print (stub `window.print` via
    `page.exposeFunction`/`addInitScript` so the real OS print dialog never
    opens), then assert the properties body is present and visible.

---

## Suggested sequencing

1. **Part 1** — the global reset. Self-contained, no component changes,
   immediately checkable by printing any page.
2. **Part 2** — `RecipeDetailComponent`/`PropertiesPanelComponent` print
   styles. Depends only on Part 1 having already reset colors/margins.
3. **Part 3** — the Print button and force-expand wiring. Most useful to
   build last, once Parts 1-2 make the print output it triggers actually
   look right.

## Deferred

- A dedicated print-preview route or in-app preview pane — printing relies
  entirely on the browser's own print-preview UI (Ctrl/Cmd+P already shows
  one) rather than building a second one inside the app.
- Restoring the properties panel's prior collapsed state after printing via
  the `afterprint` event — left expanded, deliberately, to keep this pass
  small.
- A "print multiple / print shopping list" batch flow —
  `FUTURE_IDEAS.md` item 14 (meal planning / shopping list) territory, not
  this one.
- PDF export as a first-class feature (rather than via the browser's
  "Save as PDF" print destination) — `FUTURE_IDEAS.md` item 13.
