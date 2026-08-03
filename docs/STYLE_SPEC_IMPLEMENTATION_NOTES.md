# Style Spec Implementation — Summary & Lessons Learned

Notes from implementing `CODE_STYLE_SPEC.md` (2026-07-25) via orchestrated
subagents; the spec's per-item "Resolution" notes cover what changed, this
covers how.

## Summary

**Task:** Implement `CODE_STYLE_SPEC.md` (tooling, DI, signals migration,
cleanup items) via subagents, one per point.

**Approach:** 6 phases by file-dependency, not the doc's bullet order:
ESLint/Prettier setup + a repo-wide format pass alone first (Prettier
rewrites every file, so it'd collide with concurrent edits); four parallel
background agents on disjoint file sets (misc-mechanical, recipe-list,
recipe-detail, recipe-form), each given exact current/target code and a
"don't touch files outside X" boundary; one sequential agent for the
delete-confirm extraction once recipe-list/recipe-detail landed; manual doc
updates and final verification.

**Result:** All P0/P1 resolved, all P2 resolved or explicitly deferred with
a reason; lint/tsc/tests/build clean.

## Notable catches

- `takeUntilDestroyed()` with no args only works inside an injection context
  — called bare inside `ngOnInit` it throws `NG0203` at runtime, not compile
  time, so `tsc` won't catch it. The recipe-form agent used an explicit
  `DestroyRef` everywhere instead.
- Signals don't narrow like plain property reads in templates —
  `@if (recipe(); as r)` beats repeated `recipe()!.x`. Two agents converged
  on the `as`-binding pattern independently.
- New ESLint template rules flagged 3 pre-existing a11y errors in
  `confirm-dialog.component.ts`, predating this work. Agents confirmed via
  `git diff` they hadn't introduced it and left it alone.

## Lessons Learned

- **Sequencing beats parallelism when files or a formatter overlap.**
  Tooling that rewrites every file can't run concurrently with edits to
  those files — group work by file ownership, not spec-bullet, and only
  parallelize groups with zero overlap.
- **Literal before/after code snippets beat descriptions of intent.** Agents
  were told to re-read files fresh (Prettier had already reformatted
  everything) but still given pre-formatting code as a reference for what to
  change conceptually — avoided stale-diff failures and produced consistent
  output across the 3 near-identical component migrations.
- **Telling agents what not to do prevented scope creep.** Each migration
  agent was told not to touch the delete-confirm flow or the standalone
  flag; otherwise one would likely have "helpfully" fixed the duplication
  itself, colliding with the dedicated extraction step later.
- **Not everything in a spec deserves equal treatment.** The P2 "test
  coverage" item had no concrete convention to adopt, just a note it's worth
  tracking — left as a flagged, intentional deferral rather than generating
  a full test suite or silently skipping it.
