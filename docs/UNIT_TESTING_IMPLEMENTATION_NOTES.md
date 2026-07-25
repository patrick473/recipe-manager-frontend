# Unit Testing Spec Implementation — Summary & Lessons Learned

Notes from implementing `UNIT_TESTING_SPEC.md` (2026-07-25), done via
orchestrated subagents rather than a single pass. Kept alongside the spec
for future reference on *how* the coverage got written, not just what
exists (the spec doc's own checklist covers that).

## Summary

**Task:** Bring `recipe-manager-frontend/src` from one covered service
(`RecipeService`) to full P0/P1 coverage per `UNIT_TESTING_SPEC.md`, plus
wire the frontend CI workflow the spec calls out as a follow-up.

**Approach:** Split the spec into 3 parallel background agents grouped by
file ownership, matching the spec's own P0/P0/P1 section boundaries:

1. **Services & interceptor** — extended `recipe.service.spec.ts`
   (`getById`/`create`/`update`), new specs for `ConfirmDialogService`,
   `ThemeService`, `apiBaseUrlInterceptor`. No `TestBed` component wiring,
   fastest group.
2. **Route components** — `recipe-list`, `recipe-detail`, `recipe-form`.
   The actual CRUD user journeys, and the largest slice (24 tests across
   the three).
3. **Shell & shared UI** — `nav-bar`, `confirm-dialog` component,
   `button.directive`.

Each agent's prompt embedded the actual current source of every file it
needed to test (component class, not just a description of it) plus the
exact target behaviors and expected message strings pulled directly from
the spec doc's line-numbered references, and an explicit boundary: don't
touch spec files outside your group, don't touch component source at all.
P2 (`icon`/`loader`) was explicitly left unwritten per the spec's own
"skip if no branching logic" guidance rather than delegated.

CI (`recipe-manager-frontend/.github/workflows/ci.yml`, mirroring the
backend's shape) and final verification (`ng test`, `lint`,
`format:check`) were done directly afterward rather than delegated, since
they needed the full picture across all three agents' output.

**Result:** 10 spec files, 69 tests, all passing. Lint and format clean on
every file this work touched.

## Lessons Learned

**File-ownership boundaries let three agents run fully in parallel with
zero collisions.** Unlike the earlier style-spec migration (where a
repo-wide formatter pass had to run alone before anything else), test
files are additive and don't share files across the three groups — so all
three ran concurrently from the start with no sequencing step needed. The
general rule still held: parallelize by *file ownership*, not by
spec-bullet.

**The documented test-run command doesn't actually work, and every agent
had to discover that independently.** `CLAUDE.md` and the spec doc both
say `npx vitest run <path>`. In this repo that fails immediately with
`Need to call TestBed.initTestEnvironment() first` — the
`@angular/build:unit-test` builder constructs Vitest's config (jsdom,
zone.js, Angular JIT/TestBed wiring) programmatically, so there's no
on-disk `vitest.config.ts` for bare Vitest to use. The working form is
`npx ng test --include=<path> --watch=false`. All three agents hit this
and worked around it on their own; worth fixing the command in `CLAUDE.md`
now that it's confirmed wrong, so the next session doesn't re-derive it a
fourth time. (Saved to persistent memory in the meantime.)

**Full-project type-checking makes "verify your own slice" harder under
concurrent edits.** `ng test` without `--include` type-checks the entire
`tsconfig.spec.json` program, so a compile error in any one in-progress
`*.spec.ts` file — inevitable when three agents are mid-edit at once —
fails the whole run for everyone, not just the agent that caused it.
`--include` scopes both compilation and execution to the given files,
which is what actually let each agent verify in isolation without waiting
on the other two to finish.

**The Angular template compiler enforces access modifiers that a bare
`tsc` check wouldn't necessarily surface the same way in test code.**
Components use `protected`/`private` members by convention (per
`CLAUDE.md`'s frontend style rules); specs reaching into them for signal
assertions had to use bracket notation (`component['recipes']()`) for
properties, not just for the method calls the spec doc's examples showed.

**One agent skipped formatting its own new files before reporting
done.** Two of the shell/shared-UI spec files weren't run through
`prettier --write` before that agent finished — caught only at the final
manual `format:check` pass across all three groups' output. Worth telling
agents explicitly to lint/format their *own* new files before reporting
completion, not just rely on a final sweep to catch it.

**A pre-existing lint issue resurfaced — same one as last time, and this
time it got fixed.** `confirm-dialog.component.ts` still had the 3 a11y
lint errors (backdrop/dialog click handlers without keyboard equivalents)
noted in `STYLE_SPEC_IMPLEMENTATION_NOTES.md` from the previous
style-convergence work. It's unrelated to test coverage — writing a spec
for a component doesn't change its template — so it was initially left
alone and flagged rather than fixed inline with the test-writing work.
Once this session's CI workflow made lint an actual gate rather than a
manual check, "flag it and move on" stopped being enough — a CI workflow
that's red on day one has negative value — so it was fixed as an explicit
follow-up: `tabindex="-1"` + `(keydown.escape)="respond(false)"` on the
backdrop, `(keydown)="$event.stopPropagation()"` alongside the dialog's
existing click-stopPropagation. `npm run lint` is clean project-wide as of
this doc. The pattern worth keeping: a lint rule newly enforced by CI is a
legitimate reason to fix pre-existing debt it touches, even when that debt
predates and is unrelated to the task that added the CI gate — but only
once there's a concrete trigger (the gate going live), not preemptively
just because the linter noticed.
