# Recipe List Quick Wins Implementation — Summary & Lessons Learned

Notes from implementing `RECIPE_LIST_QUICK_WINS_SPEC.md` (2026-07-26), done
via orchestrated subagents.

## Summary

**Task:** Implement all five "quick wins" — search & tag filtering, sort
controls, total-time display, recipe duplication ("Clone"), and empty/error
state polish — across `RecipeListComponent`, `RecipeDetailComponent`, and
`RecipeFormComponent`.

**Approach:** Mapped which spec parts touch which files before dispatching
anything, since that determines safe parallelism. Parts 1/2/5 form a strict
dependency chain, all in `RecipeListComponent`'s four files. Part 4 (clone)
is fully independent, touching only `RecipeDetailComponent`/
`RecipeFormComponent`. Part 3 (total time) was the odd one out: small and
logically independent, but its template changes land in **both**
`recipe-list.component.html` and `recipe-detail.component.html` — the same
files the other two tracks were about to edit. To avoid two subagents
racing on the same files, Part 3 was implemented directly (not delegated)
first — a ~15-line util plus two template additions — so both parallel
agents would start from an already-consistent baseline. Only then were two
`angular-architect` subagents launched concurrently in the background:
Agent A for Parts 1/2/5 in `RecipeListComponent` (told Part 3 was already
in place, not to touch the other two components), Agent B for Part 4 (told
the total-time span was already in the detail template, not to touch
`RecipeListComponent`). Each agent got the spec location, patterns to
mirror, `CODE_STYLE_SPEC.md` constraints, an explicit file-ownership
boundary, and instructions to self-verify (`tsc --noEmit`, lint, targeted
tests) before reporting back.

**Result:** Both agents completed cleanly. Re-verified independently:
`tsc --noEmit` clean, lint clean, full suite **111/111 tests passing**,
`npm run build:prod` succeeded. No backend/`openapi.yaml` changes needed.

**Follow-up fix:** A visual review after landing caught the search
`<input>` and sort `<select>` rendering at slightly different heights than
each other and the adjacent buttons. Root cause: `.recipe-search-input`/
`.recipe-sort-select` only set `padding`/`border`, leaving `font-size`/
`line-height` at browser UA-defaults, while neighboring `appButton`
elements get explicit `font-size`/`line-height` from the shared `.btn`
classes. Fixed by pinning explicit `height`, `box-sizing: border-box`,
`font-size`, and `line-height` on both controls to match the button box
model.

## Lessons Learned

**Map file overlap across spec parts before deciding what to parallelize —
not just logical dependency.** Parts 1/2/5 and Part 4 had no logical
dependency on Part 3, but two of the three tracks physically touched the
same two template files. Dependency graphs based only on feature-data needs
miss this; the real constraint for safe subagent parallelism is file
ownership. Doing the small shared-file piece directly first, then fanning
out on the now-disjoint remainder, avoided any risk of racing `Edit` calls.

**Not every piece of work needs a subagent.** Part 3 was a 15-line pure
function plus two template one-liners — spawning a subagent would have
added a full round-trip (cold context, spec re-reading, self-verification)
for less work than writing the prompt would take. Doing it directly and
reserving subagents for the two genuinely larger, independent chunks
matched delegation cost to task size.

**Automated verification (type-check, lint, unit tests) did not — and
structurally could not — catch the search/sort height mismatch.** jsdom
doesn't compute real font metrics or box heights, so a purely visual
box-model defect is invisible to the entire automated suite even with all
111 tests passing. Mirrors the earlier Playwright-timing-races lesson that
automated checks passing is not proof of visual correctness: on UI work,
passing checks are necessary but never sufficient — a real visual pass is
the only thing that closes the gap.

**Root cause worth remembering:** any new native `<input>`/`<select>`
placed next to elements styled by this project's `.btn`/`.btn-s` classes
will default to mismatched height unless it explicitly matches those
classes' `font-size`/`line-height`/`box-sizing` — there's no global
form-control reset, so this must be done per new control.

**Giving parallel background agents an explicit "this file already has X
in it, done by someone else, don't touch it" note prevented
cross-contamination** — both agents' diffs left the other's already-landed
Part 3 changes untouched, with no attempt to "helpfully" reconcile code
outside their assigned scope.
