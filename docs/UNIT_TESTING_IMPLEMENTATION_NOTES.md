# Unit Testing Spec Implementation — Summary & Lessons Learned

Notes from implementing `UNIT_TESTING_SPEC.md` (2026-07-25), kept alongside
the spec for future reference on _how_ the coverage got written.

## Summary

**Task:** Bring `recipe-manager-frontend/src` from one covered service
(`RecipeService`) to full P0/P1 coverage per `UNIT_TESTING_SPEC.md`, plus
wire the frontend CI workflow the spec calls out as a follow-up.

**Approach:** Split into 3 parallel background agents by file ownership,
matching the spec's P0/P0/P1 boundaries: services & interceptor (no
`TestBed` wiring, fastest); route components (list/detail/form — the
largest slice, 24 tests); shell & shared UI (nav-bar, confirm-dialog,
button directive). Each prompt embedded the actual source it needed to
test plus target behaviors/expected strings from the spec, with a
boundary not to touch other groups' spec files or any component source.
P2 (icon/loader) left unwritten per the spec's own guidance. CI workflow
and final verification (`ng test`, `lint`, `format:check`) were done
directly afterward, since they needed the full picture across all three
agents' output.

**Result:** 10 spec files, 69 tests, all passing. Lint and format clean on
every touched file.

## Notable catches

- The documented run command (`npx vitest run <path>`, per `CLAUDE.md` and
  the spec) fails immediately with `Need to call TestBed.initTestEnvironment()
first` — `@angular/build:unit-test` builds Vitest's config programmatically,
  so there's no on-disk `vitest.config.ts`. Working form:
  `npx ng test --include=<path> --watch=false`. All three agents hit this
  independently; saved to persistent memory, worth fixing in `CLAUDE.md`.
- `ng test` without `--include` type-checks the whole `tsconfig.spec.json`
  program, so one in-progress agent's compile error fails the run for
  everyone. `--include` scopes both compilation and execution, letting each
  agent verify its own slice in isolation.
- The Angular template compiler enforces `protected`/`private` access
  modifiers more strictly than a bare `tsc` check; specs reaching into
  components for signal assertions needed bracket notation
  (`component['recipes']()`), not just for method calls.
- One agent skipped `prettier --write` on its own new files, caught only at
  the final manual `format:check` pass.
- A pre-existing lint issue resurfaced: `confirm-dialog.component.ts` still
  had the 3 a11y errors (click handlers without keyboard equivalents) noted
  in `STYLE_SPEC_IMPLEMENTATION_NOTES.md` from prior work. Left alone
  initially (unrelated to test coverage), then fixed once this session's new
  CI workflow made lint an actual gate (`tabindex="-1"` +
  `(keydown.escape)`/`(keydown)="$event.stopPropagation()"`). `npm run lint`
  is clean project-wide as of this doc.

## Lessons Learned

- Parallelize by file ownership, not by spec-bullet: test files are
  additive and don't share files across groups, so all three agents ran
  fully concurrently from the start with zero collisions — unlike an
  earlier repo-wide formatter pass that had to run alone first.
- Tell agents explicitly to lint/format their own new files before
  reporting completion; a final sweep alone isn't reliable.
- A lint rule newly enforced by CI is a legitimate reason to fix
  pre-existing debt it touches, even debt unrelated to the task that added
  the gate — but only once there's a concrete trigger (the gate going
  live), not preemptively just because the linter noticed.
