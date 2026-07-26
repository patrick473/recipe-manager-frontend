# Recipe List Quick Wins Implementation — Summary & Lessons Learned

Notes from implementing `RECIPE_LIST_QUICK_WINS_SPEC.md` (2026-07-26), done via
orchestrated subagents. Kept alongside the spec for future reference on _how_
the work happened, not just what changed.

## Summary

**Task:** Implement all five "quick wins" from the spec — search & tag
filtering, sort controls, total-time display, recipe duplication ("Clone"),
and empty/error state polish — across `RecipeListComponent`,
`RecipeDetailComponent`, and `RecipeFormComponent`.

**Approach:** Before dispatching any agent, mapped which spec parts touch
which files, since that determines what can safely run in parallel:

- Parts 1 (search/tag filter) → 2 (sort) → 5 (empty/error polish) form a
  strict dependency chain and all live in `RecipeListComponent`'s four files
  (`filteredRecipes()` from Part 1 feeds `sortedRecipes()` in Part 2, which
  Part 5's "no matches" state depends on) — one agent, sequentially.
- Part 4 (clone) is fully independent, touching only
  `RecipeDetailComponent`/`RecipeFormComponent`.
- Part 3 (total time) was the odd one out: small and independent in *logic*,
  but its template changes land in **both** `recipe-list.component.html` and
  `recipe-detail.component.html` — the same two files the other two tracks
  were about to edit.

To avoid two subagents racing on the same files, Part 3 was implemented
directly (not delegated) as a first step — a ~15-line util plus two template
additions — so both parallel agents would start from an already-consistent
baseline instead of colliding mid-edit. Only after that landed and
type-checked cleanly were two `angular-architect` subagents launched
concurrently in the background:

1. **Agent A** — Parts 1, 2, 5 in `RecipeListComponent` (search, sort,
   empty/error states), explicitly told Part 3 was already in place and not
   to touch `RecipeDetailComponent`/`RecipeFormComponent`.
2. **Agent B** — Part 4 (clone) in `RecipeDetailComponent`/
   `RecipeFormComponent`, explicitly told the total-time span was already in
   the detail template and not to touch `RecipeListComponent`.

Each agent was given the spec file location, current file contents/patterns
to mirror, `CODE_STYLE_SPEC.md` constraints, an explicit file-ownership
boundary, and instructions to self-verify (`tsc --noEmit`, lint, targeted
tests) before reporting back.

**Result:** Both agents completed successfully and reported clean
self-verification. Re-verified independently afterward across the whole
project: `tsc --noEmit` clean, `npm run lint` clean, full suite
**111/111 tests passing**, and `npm run build:prod` succeeded. No backend or
`openapi.yaml` changes were needed, per the spec.

**Follow-up fix:** After landing, a visual review caught that the search
`<input>` and sort `<select>` in the new toolbar rendered at slightly
different heights than each other and than the adjacent buttons. Root cause:
`.recipe-search-input`/`.recipe-sort-select` only set `padding`/`border`,
leaving `font-size`/`line-height` at the browser's UA-default for form
controls, while the neighboring `appButton` elements get explicit
`font-size: var(--font-size-sm)` / `line-height: 1.2` from the shared `.btn`
classes — a small but visible mismatch. Fixed by pinning an explicit
`height`, `box-sizing: border-box`, `font-size`, and `line-height` on both
controls to match the button box model.

## Lessons Learned

**Map file overlap across spec parts before deciding what to parallelize —
not just logical dependency.** Parts 1/2/5 and Part 4 had no *logical*
dependency on Part 3, but two of the three tracks physically touched the same
two template files. Dependency graphs based only on "does this feature need
that feature's data" miss this; the actual constraint for safe subagent
parallelism is file ownership. Doing the small shared-file piece directly
first, then fanning out on the now-disjoint remainder, avoided any risk of
two agents' `Edit` calls racing on the same file.

**Not every piece of work needs a subagent.** Part 3 was a 15-line pure
function plus two template one-liners. Spawning a subagent for it would have
added a full round-trip (cold context, spec re-reading, self-verification)
for less work than writing the prompt would have taken. Doing it directly and
reserving subagents for the two genuinely larger, independent chunks (each
touching 4-5 files with real test-writing work) matched delegation cost to
task size.

**Automated verification (type-check, lint, unit tests) did not — and
structurally could not — catch the search/sort height mismatch.** All 111
tests passed, lint was clean, and the build succeeded, yet the bug was
plainly visible in a rendered page. jsdom (what Angular's test runner uses)
doesn't compute real font metrics or box heights, so a purely visual
box-model defect like this is invisible to the entire automated suite. This
is the same category of gap noted before for Playwright timing races
(automated checks passing is not proof of visual correctness) — the
takeaway here is the mirror image: automated checks passing on UI work is
necessary but never sufficient, and a real visual pass (browser or careful
manual review) is the only thing that closes that gap.

**Root cause worth remembering for next time:** any new native
`<input>`/`<select>` dropped into a row next to elements styled by this
project's `.btn`/`.btn-s` classes will default to mismatched height unless it
explicitly matches those classes' `font-size`/`line-height`/`box-sizing`.
The design system doesn't apply a global form-control reset, so this has to
be done per new control rather than assumed.

**Giving parallel background agents an explicit "this file already has X in
it, done by someone else, don't touch it" note prevented cross-contamination**
— both agents' final diffs left the other's already-landed Part 3 changes
untouched, and neither tried to "helpfully" reconcile or restyle code outside
its assigned scope.
