# Print-Friendly Recipe View Implementation — Summary & Lessons Learned

Notes from implementing `PRINT_FRIENDLY_RECIPE_VIEW_SPEC.md` (2026-07-30),
kept alongside the spec for future reference on _how_ the work happened,
not just what changed.

## Summary

**Task:** Ship `FUTURE_IDEAS.md` item 10 — a `@media print` stylesheet for
`RecipeDetailComponent`, plus a discoverable Print button, with no backend
change and no new route.

**Approach:** The spec was fully written going in, with exact code for
every file and a "Suggested sequencing" section describing a strict
dependency chain (Part 2 depends on Part 1's reset; Part 3 is "most useful
to build last, once Parts 1-2 make the print output it triggers actually
look right") rather than calling out any pair as independent of each other.
Unlike `FAVORITES_RECENTLY_VIEWED_SPEC.md`, where Parts 2/3 were explicitly
independent and dispatched concurrently, this spec's sequencing read as
purely sequential — so all three parts were dispatched as one subagent
each, one at a time, none starting before the previous one's diff landed:

1. Part 1 (`_print.scss` + the `styles.scss` `@use` line) — self-contained.
2. Part 2 (component-scoped `@media print` CSS in
   `recipe-detail.component.scss` / `properties-panel.component.scss`) —
   dispatched only after Part 1 landed.
3. Part 3 (the Print button, `printRecipe()`/`expand()` wiring, and the two
   spec'd unit tests) — dispatched only after Part 2 landed.
4. The Playwright e2e test (`e2e/tests/recipe-print.spec.ts`) run last,
   once the CSS and button it exercises both existed.

**Result:** 186/186 frontend unit tests passing (184 pre-existing +
`properties-panel.component.spec.ts` new + one new `recipe-detail` test),
`ng build` clean (one pre-existing, unrelated budget warning on
`recipe-list.component.scss`), `ng lint` clean. New Playwright e2e coverage
in `recipe-print.spec.ts` passes: `@media print` hides `.side-nav`,
`.detail-actions`, `.breadcrumbs` while the title and `.markdown-body`
content stay visible; clicking Print force-expands a collapsed properties
panel before the (stubbed) `window.print()` call.

**Notable catches:**

- The spec's own testing section prescribed `fakeAsync`/`tick()` for
  flushing `printRecipe()`'s `setTimeout`, but this repo's Angular test
  builder runs on Vitest, not Karma/Jasmine — Vitest isn't Zone-patched, so
  `fakeAsync` throws `Expected to be running in 'ProxyZone', but it was not
found`. `recipe-list.component.spec.ts` already had a working precedent
  for this exact mismatch (its search-debounce test), using
  `vi.useFakeTimers()` / `vi.runAllTimersAsync()` in a try/finally with
  `vi.useRealTimers()`. Followed that existing convention instead of the
  spec's literal instruction, since it's what actually passes in this
  project's real test environment.
- `properties-panel.component.spec.ts` didn't exist before this work (the
  spec assumed a "+ `.spec.ts`" pattern as if editing an existing file);
  the Part 3 subagent created it fresh, following the standalone-component
  TestBed convention already used by `confirm-dialog.component.spec.ts`.
- The e2e test needed a recipe with `servings`/`prepTimeMinutes` set — with
  no properties set, `PropertiesPanelComponent.hasAnyValue()` is false and
  `.properties-body` never renders at all in read-only mode, regardless of
  `expanded()`, which would have made the force-expand assertion
  meaningless. Seeding a recipe with those fields via the API before
  navigating to it was necessary for the test to actually exercise the
  force-expand path rather than trivially pass on an empty panel.

## Lessons Learned

**A "Suggested sequencing" section without an explicit independence
callout should be treated as fully sequential, not partially
parallelizable.** `FAVORITES_RECENTLY_VIEWED_SPEC.md` named two parts as
independent of each other up front; this spec never did — its sequencing
prose only describes one part depending on the last ("depends only on Part
1", "most useful to build last"). Reading that literally (per
[[feedback_subagent_orchestration]]) meant dispatching one subagent per
part, strictly in order, rather than looking for file-level parallelism
opportunities the spec itself didn't offer. It would have been technically
possible to parallelize here too (Parts 1/2/3 touch entirely disjoint
files), but the spec's own framing was about output correctness order
("Part 2 needs Part 1's reset in place to look right"), not just avoiding
file conflicts — so sequential dispatch matched intent, not just safety.

**A spec's literal test instructions can be wrong about the test
runner's actual constraints, and an existing in-repo precedent beats
following the letter of the spec.** The spec was written assuming
`fakeAsync` would work (a reasonable default for Angular testing in
general), but this repo's specific Vitest-based builder doesn't support
it. Rather than fighting the spec's literal wording, the subagent found
and matched the pattern the codebase had already solved this with
elsewhere — the right move when a spec's implementation detail conflicts
with empirical fact about the actual toolchain.
