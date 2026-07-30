# Ingredient Scaling Implementation — Summary & Lessons Learned

Notes from writing `INGREDIENT_SCALING_SPEC.md` and implementing it in the
same session (2026-07-30). Kept alongside the spec for future reference on
_how_ the work happened, not just what changed.

## Summary

**Task:** Ship `FUTURE_IDEAS.md` item 8 — let a user scale ingredient
quantities on the recipe detail page.

**Approach:** Before writing the spec, read the existing Markdown content
convention directly from `mock-recipes.json` (bullet-list quantities: plain
integers, mixed numbers like `1 1/2`, simple fractions, numbers glued to a
metric unit like `400g`, and non-numeric lines like `salt to taste`) and the
current `RecipeDetailComponent` rendering path (`marked.parse()` → sanitize
→ a plain signal, set once in `ngOnInit`), via a background Explore
subagent — small enough to delegate cleanly since it was pure read-only
fact-finding with a fixed, enumerable question list. Then read an existing
spec (`IMAGE_SUPPORT_SPEC.md`) to match this repo's established structure
before writing `INGREDIENT_SCALING_SPEC.md`, rather than inventing a new
format.

The one real design decision — parse the existing Markdown vs. build a
structured `Ingredient` data model — was already answered by
`FUTURE_IDEAS.md`'s own tiering: item 8 is filed as a "Medium feature,"
item 12 ("Structured ingredients & steps") as a separate "Bigger
investment." Treating that tiering as scope guidance, not just a
description, kept this to one new frontend util + one component's worth of
wiring, with no backend or `openapi.yaml` change.

Implementation itself was small enough (one new pure util, one component)
to do directly rather than delegate to a subagent — no cross-file seam to
worry about, unlike the multi-repo image-support work.

**Result:** 155/155 frontend tests passing, lint clean, prettier clean,
`ng build` clean. Manually verified against the real backend: started
`mvn spring-boot:run` and drove a headless-Chromium session (via raw
Playwright, see "Notable catches" below) against `/recipes/3` (Chicken
Tikka Masala, servings: 4). Clicking the servings stepper from 4 → 6
correctly scaled every quantity line by 1.5× (`700g` → `1050g`, `3 cloves`
→ `4.5 cloves`, etc.), left `salt to taste` and the numbered `Instructions`
section byte-for-byte unchanged, and threw no console errors.

**Notable catches:**

- The first draft of `hasScalableIngredients()` used a shortcut — compare
  `scaleIngredientsMarkdown(content, 2)` against `scaleIngredientsMarkdown(content, 1)`
  and report "scalable" if they differ. This has a latent false-negative:
  the fraction formatter rounds to the nearest eighth, so a fraction finer
  than an eighth (e.g. a `1/16`) can normalize to the *same* displayed
  eighth at both factor 1 and factor 2, making the diff report "not
  scalable" for a line that actually is. No test caught this — none of the
  written tests used a denominator finer than eighths. Caught by reasoning
  through the rounding table by hand, not by a failing test. Replaced with
  a direct check ("does at least one bulleted Ingredients line have a
  leading quantity token") instead of comparing two transformed outputs —
  more robust whenever the transform itself does lossy rounding.
- No project-level `/run` skill exists yet for this app, and `chromium-cli`
  wasn't available in this environment. Fell back to driving the page with
  raw Playwright (already a devDependency, used for this repo's e2e
  suite), which needed `npx playwright install chromium` since no browser
  binary was cached. The driver script also had to be run from inside
  `recipe-manager-frontend/` (not the repo root) for Node's ESM resolver to
  find the local `playwright` package.
- This repo is not a git repository (confirmed via the environment, not
  discovered mid-task), so there was no git history to check for prior art
  and no commit was made — `docs/FUTURE_IDEAS.md` plus the `*_SPEC.md` /
  `*_IMPLEMENTATION_NOTES.md` file pairs are this project's substitute for
  a changelog. Worth knowing going in rather than assuming `git log` is
  available for context.

## Lessons Learned

**Read the existing convention before writing the artifact, not after.**
Reading `IMAGE_SUPPORT_SPEC.md` before drafting the ingredient-scaling spec
— rather than writing something reasonable-looking from scratch — meant the
result matched the repo's own structure (explicit scope decision +
rationale up top, "Explicitly out of scope," a "Current state (baseline)"
section citing file:line, Parts with Behavior/Implementation/Files touched,
Testing, Suggested sequencing, Deferred) on the first pass. The user
accepted it and moved straight to "implement the spec" with no requested
changes to its shape — a quiet confirmation that mirroring the established
format was the right call, not a place to improvise.

**A backlog's own tiering is scope guidance, not just organization.**
`FUTURE_IDEAS.md` separates "Medium features" from "Bigger investments," and
item 8's own text offered two possible approaches (parse existing Markdown,
or model ingredients as structured data — the latter being item 12,
explicitly filed as bigger). Reading that split as binding, rather than
pulling item 12's scope in "since it's related," is what kept this a
same-day, backend-untouched change instead of a data-model migration.

**A predicate implemented as "diff two transformed outputs" inherits every
blind spot of the transform itself.** The `hasScalableIngredients()` bug
above is a specific instance of a general trap: if the transform being
diffed does any lossy normalization (rounding, clamping, deduplication), two
different inputs can produce identical outputs for reasons unrelated to the
question being asked. A direct predicate over the input (here: "does a
leading-quantity regex match anywhere in the Ingredients section") doesn't
have that failure mode and is usually just as easy to write.

**Passing tests are necessary but were not what actually confirmed this
feature worked.** Every written test passed on the first run this
implementation compiled — but the manual browser pass is what actually
proved the servings stepper, the live re-render, and the scaled quantities
looked and behaved correctly together in the real app, and that nothing in
the chain (marked → sanitizer → innerHTML) silently dropped the scaled
values. Worth continuing to budget for that step even when unit/component
coverage is already green, per the standing "test the golden path in a
browser for UI changes" guidance.
