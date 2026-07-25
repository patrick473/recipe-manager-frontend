# Style Spec Implementation — Summary & Lessons Learned

Notes from implementing `CODE_STYLE_SPEC.md` (2026-07-25), done via orchestrated
subagents rather than a single pass. Kept alongside the spec for future
reference on *how* the convergence happened, not just what changed (the spec
doc itself has per-item "Resolution" notes for that).

## Summary

**Task:** Implement `CODE_STYLE_SPEC.md` — a style audit covering tooling
gaps, DI conventions, signals migration, and cleanup items — using subagents
for the separate points.

**Approach:** Broke the spec into 6 phases based on file-dependency analysis
rather than following the doc's bullet order mechanically:

1. **Tooling first, foreground, blocking** — ESLint + Prettier setup and a
   repo-wide format pass, run alone before anything else touched application
   code. This mattered because Prettier reformats every file; if it ran
   concurrently with or after the other agents' edits, their diffs would've
   been noisy or their `old_string` matches would've broken.
2. **Four parallel background agents on disjoint file sets** —
   misc-mechanical (standalone flag, icon input API), recipe-list,
   recipe-detail, recipe-form. Each got the exact current code, the exact
   target code, and an explicit "don't touch files outside X" boundary.
3. **One sequential agent for the delete-confirm extraction** — this had to
   wait for both recipe-list and recipe-detail to land, since it edits files
   those agents had just changed.
4. **Manual wrap-up** — doc updates and final verification, done directly
   rather than delegated since they were quick and needed a judgment call on
   scope.

**Result:** All P0/P1 items resolved, all P2 items resolved or explicitly
deferred with a stated reason. Verified with lint/tsc/tests/build at the end.

## Lessons Learned

**Sequencing beats parallelism when files or a formatter overlap.** The
instinct is to fan everything out to subagents at once, but
tooling-that-rewrites-every-file and edits-to-those-same-files can't safely
run concurrently. The rule that generalized well: group work by *file
ownership*, not by spec-bullet, and only parallelize groups with zero file
overlap.

**Giving agents literal before/after code snippets in the prompt worked
better than describing intent.** Since Prettier had already reformatted
everything, each agent was told explicitly "re-read the file fresh, don't
trust old indentation" — but still given the pre-formatting code as a stable
reference for *what to change conceptually*. This avoided both stale-diff
failures and vague "please migrate this component" prompts that would've
produced inconsistent output across the 3 near-identical component
migrations.

**The subagents surfaced real Angular gotchas only sketched in the prompt:**
- `takeUntilDestroyed()` with no args only works inside an actual injection
  context (constructor, field initializer). Calling it bare inside
  `ngOnInit` throws `NG0203` at *runtime*, not compile time — `tsc` won't
  catch it. One agent (recipe-form) called this out explicitly and used an
  explicit `DestroyRef` everywhere for consistency; worth treating as a
  checklist item, not just "add takeUntilDestroyed and move on."
- Signal calls don't narrow the same way plain property reads do in
  templates — `@if (recipe(); as r)` reads cleaner than repeated
  `recipe()!.x` non-null assertions. Two agents converged on the
  `as`-binding pattern independently, a good sign it's the right idiom.

**Explicitly telling agents what *not* to do prevented scope creep.** Each
migration agent was told "don't extract the delete-confirm flow yet, don't
touch the standalone flag, that's someone else's file" — without that, at
least one probably would have "helpfully" fixed the duplication itself
mid-migration, colliding with the dedicated extraction step later.

**Not everything in a spec deserves equal treatment.** The P2 "test
coverage" item had no concrete "convention to adopt," just a note that it's
worth tracking — deliberately not generating a full test suite for it, since
that's a different kind of work (net-new behavior verification) than the
mechanical/structural convergence the rest of the doc asked for. Flagging it
as intentionally deferred (with a reason) in the final report and in the
spec doc itself seemed more honest than silently skipping it or
silently over-delivering.

**A lingering pre-existing issue surfaced by new tooling isn't automatically
in scope.** The new ESLint template rules flagged 3 pre-existing a11y errors
in `confirm-dialog.component.ts` (backdrop click without a keyboard
equivalent) that predate this work and aren't part of the spec. Multiple
agents independently verified via `git diff` that they hadn't introduced it
before leaving it alone — "the linter now complains" isn't the same as
"this was my task."
