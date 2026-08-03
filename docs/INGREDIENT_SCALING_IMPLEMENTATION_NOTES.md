# Ingredient Scaling Implementation — Summary & Lessons Learned

Notes from implementing [INGREDIENT_SCALING_SPEC.md](INGREDIENT_SCALING_SPEC.md)
(2026-07-30), spec and implementation done in the same session.

## Summary

**Task:** Ship `FUTURE_IDEAS.md` item 8 — scale ingredient quantities on the
recipe detail page.

**Approach:** Read the Markdown convention directly from `mock-recipes.json`
and `RecipeDetailComponent`'s rendering path via a background Explore
subagent (read-only fact-finding, safe to delegate), then read
`IMAGE_SUPPORT_SPEC.md` to match this repo's spec structure before writing.
The one real design call — parse existing Markdown vs. a structured
`Ingredient` model — was already answered by `FUTURE_IDEAS.md`'s own tiering
(item 8 "Medium," item 12 "Bigger investment"), keeping this to one new
frontend util plus one component's wiring, no backend change. Implementation
was small enough (one util, one component) to do directly rather than
delegate.

**Result:** 155/155 frontend tests passing, lint/prettier/build clean.
Manually verified against the real backend via a headless-Chromium
Playwright session against a real recipe: the servings stepper scaled every
quantity line correctly, left non-numeric lines and Instructions untouched,
no console errors.

## Notable catches

- First draft of `hasScalableIngredients()` compared
  `scaleIngredientsMarkdown(content, 2)` vs.
  `scaleIngredientsMarkdown(content, 1)` and reported "scalable" on a diff —
  a latent false negative, since the fraction formatter rounds to the
  nearest eighth and a finer fraction (e.g. `1/16`) can normalize to the same
  eighth at both factors. No test caught it (none used a denominator finer
  than eighths); found by hand-reasoning through the rounding table.
  Replaced with a direct predicate ("does a leading-quantity token match
  anywhere in the Ingredients section") — more robust against transforms
  that do lossy rounding.
- No project `/run` skill and no `chromium-cli` available; fell back to raw
  Playwright (already a devDependency), which needed
  `npx playwright install chromium` and had to be run from inside
  `recipe-manager-frontend/` for Node's ESM resolver to find the local
  package.
- Repo is not a git repository (confirmed via the environment, not
  discovered mid-task) — no commit made; the `*_SPEC.md`/
  `*_IMPLEMENTATION_NOTES.md` pairs are this project's changelog substitute.

## Lessons Learned

- **Read the existing convention before writing the artifact, not after.**
  Reading `IMAGE_SUPPORT_SPEC.md` before drafting meant the result matched
  the repo's structure on the first pass — the user moved straight to
  "implement" with no requested changes, a quiet confirmation that mirroring
  the established format was right.
- **A backlog's own tiering is scope guidance, not just organization.**
  Reading `FUTURE_IDEAS.md`'s "Medium" vs. "Bigger investment" split as
  binding, rather than pulling item 12's scope in "since it's related," kept
  this a same-day, backend-untouched change.
- **A predicate implemented as "diff two transformed outputs" inherits every
  blind spot of the transform.** If the transform being diffed does lossy
  normalization (rounding, clamping, dedup), different inputs can produce
  identical outputs for unrelated reasons. A direct predicate over the input
  doesn't have that failure mode and is usually just as easy to write.
- **Passing tests aren't what actually confirmed this worked.** Every test
  passed on first compile, but the manual browser pass is what proved the
  stepper, live re-render, and scaled quantities worked together in the real
  app end-to-end — worth budgeting for even when unit/component coverage is
  green.
