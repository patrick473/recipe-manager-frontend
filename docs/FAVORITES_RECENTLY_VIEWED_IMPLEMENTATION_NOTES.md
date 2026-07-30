# Favorites & Recently Viewed Implementation — Summary & Lessons Learned

Notes from implementing `FAVORITES_RECENTLY_VIEWED_SPEC.md` (2026-07-30),
kept alongside the spec for future reference on _how_ the work happened,
not just what changed.

## Summary

**Task:** Ship `FUTURE_IDEAS.md` item 9 — localStorage-backed favorites and
recently-viewed recipe tracking, surfaced as two optional strips on the
`/recipes` list page, with no backend change and no new routes.

**Approach:** The spec was already written and complete going in, with an
explicit "Suggested sequencing" section (Part 1 → 3 → 2 → 4) and per-part
Behavior/Implementation/Files-touched breakdowns detailed enough to
implement directly. Followed that sequencing via four subagent dispatches
rather than one big pass:

1. Part 1 (the two storage services) run alone first, since every other
   part depends on it.
2. Parts 2 and 3 dispatched **concurrently** in a single message once Part
   1 landed — the spec calls them out as independent of each other (Part 2
   only needs `FavoritesService`, Part 3 only needs `RecentlyViewedService`),
   but both touch `recipe-detail.component.ts`/`.spec.ts`.
3. Part 4 (the list-page strips) run last, once 1-3 were confirmed working
   together, since it's the only part that depends on all three services'
   real behavior to be meaningful to build against.

**Result:** 184/184 frontend tests passing (178 pre-existing + 6 new from
Part 4; Parts 1-3 added their own coverage inline as the suite grew),
`tsc --noEmit` clean, `eslint` clean, `prettier --check` clean. Manually
verified against the real running app (backend on `:8080`, frontend on
`:4200`, both already up from an earlier session) via headless Playwright:
favoriting a recipe from the detail page, confirming both strips appear on
the list page with the correct card and no reload needed, un-favoriting
from the Favorites strip's overlay heart button, and clearing the Recently
Viewed strip via its "Clear" button — all matched spec behavior, and both
the grid-view and list-view action rows render the heart button correctly
alongside Edit/Delete.

**Notable catches:**

- Dispatching Parts 2 and 3 concurrently, both touching the same two files
  (`recipe-detail.component.ts` and its spec), worked cleanly with no
  merge conflict or lost edit — each agent's diff landed in a different
  region of the file (constructor injection + one line in `ngOnInit` for
  Part 3; template/`.html` changes plus a separate injected field for Part
  2) and both re-read the file before editing rather than working from a
  stale snapshot, so the second agent to finish saw and preserved the
  first agent's already-landed change. Concurrent dispatch onto shared
  files is workable here specifically because the spec had already
  partitioned the *logical* change (a signal read/toggle vs. a one-line
  side effect in an existing success handler) into non-overlapping
  concerns, even though the file-level diffs weren't disjoint — dispatching
  two agents at genuinely conflicting logical changes to the same file
  would not have been safe to parallelize this way.
- Confirmed again (see `INGREDIENT_SCALING_IMPLEMENTATION_NOTES.md` for the
  first instance of this same gotcha): a Node/Playwright driver script only
  resolves the local `playwright` package when the **script file itself**
  lives inside `recipe-manager-frontend/`, regardless of the shell's
  current working directory — Node's ESM resolver walks up from the
  script's own path, not `cwd`, to find `node_modules`. A script written to
  the session scratchpad directory 404s on `import { chromium } from
  'playwright'` even when run with `cwd` already set to the frontend
  directory; copying the script into `recipe-manager-frontend/` (and
  deleting it afterward) fixed it immediately. Worth writing verification
  scripts directly into the frontend directory from the start next time,
  rather than discovering this the same way twice.

## Lessons Learned

**A spec with an explicit dependency graph in "Suggested sequencing" is a
direct instruction for how to parallelize subagent work, not just reading
order for a human.** This spec named which parts were independent of each
other (2 and 3) versus strictly sequential (1 before everything; 4 after
everything) up front. Treating that as literal dispatch guidance — one
agent for Part 1, two concurrent agents for Parts 2/3, one final agent for
Part 4 — meant no part was ever built against a service API that hadn't
landed yet, and the one place two agents touched the same file was already
known in advance (and flagged to both agents explicitly) rather than
discovered as a surprise conflict.

**When dispatching two concurrent agents at the same file, tell both of
them so explicitly, and give each a precise, narrow edit region.** The
Part 2 and Part 3 prompts each named the other part by number, said
explicitly "you may find the file already has the other part's changes in
it," and scoped each agent to a specific, narrow change (one field + one
call site for Part 3; template/button wiring for Part 2) rather than "make
the changes described in Part 2/3." A vaguer instruction inviting either
agent to rewrite more of the file than necessary would have raised real
conflict risk; naming the exact insertion points is what made concurrent
dispatch safe here.

**Passing tests plus a real browser pass both mattered, for different
reasons.** The unit suite caught behavioral regressions immediately (e.g.
would have caught a broken `pruneDeadId` or a strip that didn't re-fetch on
signal change), but only the manual Playwright pass actually confirmed the
visual result — that the overlay heart button sits correctly outside the
strip card's `<a>` without triggering navigation on click, that both
strips' empty/non-empty `@if` gating looks right in the real DOM, and that
the grid and list view action rows both render the new button without
layout breakage. Neither check substitutes for the other on a UI-facing
change.
