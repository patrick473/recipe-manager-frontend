# Favorites & Recently Viewed Implementation — Summary & Lessons Learned

Notes from implementing `FAVORITES_RECENTLY_VIEWED_SPEC.md` (2026-07-30).

## Summary

**Task:** Ship `FUTURE_IDEAS.md` item 9 — localStorage favorites and
recently-viewed tracking, two strips on the list page, no backend change.

**Approach:** Per [[feedback_subagent_orchestration]], followed the spec's
explicit "Suggested sequencing" as literal dispatch guidance: Part 1
(storage services) alone first; Parts 2 and 3 dispatched **concurrently**
in one message since the spec called them independent (Part 2 needs only
`FavoritesService`, Part 3 only `RecentlyViewedService`) even though both
touch `recipe-detail.component.ts`/`.spec.ts`; Part 4 (list-page strips)
last, once 1-3 were confirmed working together.

**Result:** 184/184 frontend tests, clean `tsc`/`eslint`/`prettier`.
Manually verified against the real running app via headless Playwright:
favoriting from the detail page, both strips appearing live with no
reload, un-favoriting from the strip overlay, clearing recently-viewed.

**Notable catches:**

- Concurrent Parts 2/3 dispatch onto the same two files worked cleanly —
  each agent's diff landed in a different region (Part 3: one field + one
  call site in `ngOnInit`; Part 2: template/button wiring), and each
  re-read the file before editing so the second to finish preserved the
  first's already-landed change. Safe here specifically because the spec
  had partitioned the *logical* change into non-overlapping concerns before
  dispatch, not just because the file happened to have room in both spots.
- Same Node/Playwright resolution gotcha as
  `INGREDIENT_SCALING_IMPLEMENTATION_NOTES.md`: a verification script only
  resolves the local `playwright` package when the script file itself lives
  inside `recipe-manager-frontend/` — Node's ESM resolver walks up from the
  script's path, not `cwd`. Write verification scripts directly into the
  frontend directory rather than the scratchpad.

## Lessons Learned

- A spec's explicit dependency graph in "Suggested sequencing" is literal
  subagent dispatch guidance, not just human reading order.
- When dispatching two concurrent agents at the same file, tell both
  explicitly that the other exists and give each a precise, narrow edit
  region — a vaguer "make the changes in Part N" invites rewriting more
  than necessary and raises real conflict risk.
- Passing tests and a real browser pass catch different things on a
  UI-facing change: the unit suite catches behavioral regressions (a broken
  `pruneDeadId`, a strip that doesn't re-fetch), but only a manual pass
  confirms the visual result (overlay button not triggering navigation,
  `@if` gating looking right in the real DOM).
