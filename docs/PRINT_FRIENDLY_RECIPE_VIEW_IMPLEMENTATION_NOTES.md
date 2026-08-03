# Print-Friendly Recipe View Implementation — Summary & Lessons Learned

Notes from implementing `PRINT_FRIENDLY_RECIPE_VIEW_SPEC.md` (2026-07-30).

## Summary

**Task:** Ship `FUTURE_IDEAS.md` item 10 — a `@media print` stylesheet for
`RecipeDetailComponent`, plus a discoverable Print button, with no backend
change and no new route.

**Approach:** The spec's "Suggested sequencing" described a strict
dependency chain (Part 2 needs Part 1's reset in place; Part 3 "most useful
to build last") rather than calling out any pair as independent — unlike
`FAVORITES_RECENTLY_VIEWED_SPEC.md`, which named two parts independent up
front. Read literally per [[feedback_subagent_orchestration]], dispatched
one subagent per part, strictly in order, each waiting for the previous
diff to land: Part 1 (`_print.scss` + `styles.scss` `@use`) → Part 2
(component-scoped print CSS) → Part 3 (Print button + `printRecipe()`/
`expand()` wiring + unit tests) → the Playwright e2e spec, run last once
the CSS and button it exercises both existed.

**Result:** 186/186 frontend unit tests passing (184 pre-existing + one new
`properties-panel.component.spec.ts` + one new `recipe-detail` test), clean
build/lint. New `recipe-print.spec.ts` e2e passes.

**Notable catches:**

- The spec prescribed `fakeAsync`/`tick()` for flushing `printRecipe()`'s
  `setTimeout`, but this repo's Angular test builder runs on Vitest, which
  isn't Zone-patched — `fakeAsync` throws a ProxyZone error.
  `recipe-list.component.spec.ts`'s search-debounce test already had a
  working precedent (`vi.useFakeTimers()`/`vi.runAllTimersAsync()` in a
  try/finally with `vi.useRealTimers()`); followed that instead of the
  spec's literal instruction.
- `properties-panel.component.spec.ts` didn't exist before this work (the
  spec assumed an existing file); created fresh, following the standalone-
  component TestBed convention from `confirm-dialog.component.spec.ts`.
- The e2e test needed a recipe with `servings`/`prepTimeMinutes` set —
  with no properties set, `PropertiesPanelComponent.hasAnyValue()` is false
  and `.properties-body` never renders regardless of `expanded()`, which
  would make the force-expand assertion meaningless. Seeded via the API
  before navigating.

## Lessons Learned

**A "Suggested sequencing" section without an explicit independence
callout should be treated as fully sequential, not partially
parallelizable.** This spec's sequencing prose only described one part
depending on the last, never called out any pair as independent — unlike
`FAVORITES_RECENTLY_VIEWED_SPEC.md`. Per [[feedback_subagent_orchestration]],
dispatched one subagent per part strictly in order rather than looking for
file-level parallelism the spec itself didn't offer. It would have been
technically possible to parallelize (Parts 1/2/3 touch disjoint files), but
the spec's framing was about output-correctness order, not just file
conflicts — so sequential dispatch matched intent, not just safety.

**A spec's literal test instructions can be wrong about the test runner's
actual constraints, and an existing in-repo precedent beats following the
letter of the spec.** The spec assumed `fakeAsync` would work (a reasonable
default for Angular generally), but this repo's Vitest-based builder
doesn't support it. Matching the pattern the codebase had already solved
this with elsewhere was the right move over fighting the spec's wording.
