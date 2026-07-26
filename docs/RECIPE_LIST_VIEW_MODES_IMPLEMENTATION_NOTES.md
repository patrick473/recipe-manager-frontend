# Recipe List View Modes Implementation — Summary & Lessons Learned

Notes from implementing `RECIPE_LIST_VIEW_MODES_SPEC.md` (2026-07-26), done via
orchestrated subagents. Kept alongside the spec for future reference on _how_
the work happened, not just what changed.

## Summary

**Task:** Add a grid/list view-mode toggle to `RecipeListComponent`, per the
spec's "Implementation" and "Testing" sections — a `viewMode` signal persisted
to `localStorage` (mirroring `ThemeService`'s pattern), a toggle group in the
header, a new dense list layout alongside the existing card grid, and test
coverage for both.

**Approach:** Two sequential subagents, single file-ownership group each time
(no parallelism needed — everything lives in one component's four files):

1. **`frontend-developer` agent — implementation.** Given the full spec, the
   current contents of all three source files, the `ThemeService` pattern to
   mirror, and explicit style constraints from `CLAUDE.md`/`CODE_STYLE_SPEC.md`
   (inject() DI, `protected` visibility rules, no comments). Scoped to
   `.ts`/`.html`/`.scss` only — explicitly told not to touch the spec file.
2. **`frontend-developer` agent — tests.** Given the spec's "Testing" section,
   the now-implemented component code, and the existing spec file's
   conventions (bracket-access to `protected` members, `vi.fn()` fakes,
   `provideRouter([])`). Scoped to the `.spec.ts` file only.
3. **Manual verification**, done directly rather than delegated: re-read every
   file the agents touched (not just their prose summaries), ran the full
   test suite + lint + Prettier myself, then started the real backend +
   frontend and drove a headless Chromium against the running app to confirm
   the toggle actually works end-to-end, not just in jsdom.

**Result:** All spec items implemented. 76/76 tests pass, lint clean, format
clean. Browser verification confirmed default grid render, toggle click →
list markup, `aria-pressed` flip, `localStorage` persistence across a
simulated reload, and working Edit/Delete in both layouts with zero console
errors.

## Lessons Learned

**Reading the diff mattered even for a "simple" task.** Both agents reported
clean lint/format results, but a direct `prettier --check` after the fact
found the test-writing agent's file had actual formatting violations (long
lines from parameterized `describe.each` blocks) that its own self-reported
"pass" had missed or that drifted in after its own check ran. Running the
formatter myself as a final gate — not just trusting the agent's stated
outcome — caught it in seconds. Small, well-specified tasks are exactly where
it's tempting to skip this step; that's also where the cost of skipping it is
lowest to catch and highest to regret if it ships.

**Splitting "implementation" from "tests" into separate agents, sequentially,
worked well for a single-component change.** The test agent needed the real
implementation to exist first (it queries actual rendered class names like
`.recipe-list-row` and actual `aria-label` strings), so parallelizing would
have meant guessing at an interface instead of testing the real one. For a
change this contained, two sequential handoffs was the right granularity —
not so small that orchestration overhead dominated, not so large that either
agent had to hold unrelated concerns in its head at once.

**Giving each agent the literal current file contents inline in the prompt
(not just a path to read) avoided a class of drift.** Both prompts embedded
the actual current `.ts`/`.html`/`.scss` contents and the actual `ButtonDirective`
/`IconComponent`/`ThemeService` shapes rather than describing them abstractly.
This meant the agents' first action wasn't "explore the codebase to figure out
the conventions" — it went straight to implementing against a concrete,
correct baseline.

**Browser verification caught nothing the tests didn't already cover here —
and that's a useful data point, not a wasted step.** DOM-level Angular
TestBed tests (jsdom) already asserted class presence, `aria-pressed` values,
and click-through behavior. The real-browser Playwright pass confirmed the
same facts held under an actual Chromium render with the real backend, and
additionally surfaced things the unit tests structurally can't: that the page
has zero console errors, that the layout is visually sane (row alignment,
divider borders, truncation), and that the toggle really does persist across
an actual full-page `reload()` rather than just a fresh `TestBed.createComponent`
in the same test process. Worth doing even when you have strong reason to
expect it'll just confirm the tests — for a change entirely about visual
layout and persisted UI state, the tests alone don't prove the CSS renders
correctly to a human eye.

**No `chromium-cli` on this Windows dev box — adapted rather than skipped
verification.** The `run` skill's browser-driven pattern assumes a Linux
container with `chromium-cli` preinstalled; neither was true here. Fell back
to `npx playwright` (already resolvable, just needed `playwright install
chromium` once) and wrote a small one-off script instead. Worth remembering
for next time on this machine: Playwright-via-npx is the working fallback,
skip trying `chromium-cli` first.

**H2 in-memory DB meant zero manual cleanup after browser verification.**
Seeded two throwaway recipes via `POST /recipes` to have data to toggle
between layouts; killing the backend process (`Stop-Process` on the port's
PID) wiped the database automatically. No need to delete test data or reset
state — a nice property of this stack specifically worth relying on for
future ad hoc verification passes, rather than writing cleanup code for it.
