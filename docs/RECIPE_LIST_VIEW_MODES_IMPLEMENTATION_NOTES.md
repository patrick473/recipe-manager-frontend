# Recipe List View Modes Implementation — Summary & Lessons Learned

Notes from implementing `RECIPE_LIST_VIEW_MODES_SPEC.md` (2026-07-26), done via orchestrated subagents.

## Summary

**Task:** Add a grid/list view-mode toggle to `RecipeListComponent` — a `viewMode` signal persisted to `localStorage` (mirroring `ThemeService`), a toggle group, a new dense list layout, and test coverage.

**Approach:** Two sequential `frontend-developer` subagents, single file-ownership group (no parallelism needed — everything lives in one component's four files): one for implementation (given the full spec, current file contents, the `ThemeService` pattern, and `CLAUDE.md`/`CODE_STYLE_SPEC.md` constraints, scoped to `.ts`/`.html`/`.scss` only), one for tests (given the spec's Testing section, the now-implemented code, and existing spec-file conventions, scoped to `.spec.ts` only) — sequential because the test agent needed the real implementation to query actual class names/`aria-label` strings rather than guess at an interface. Manual verification done directly: re-read every touched file, ran the full test suite/lint/Prettier myself, then drove a headless Chromium against the real running app.

**Result:** All spec items implemented, 76/76 tests pass, lint/format clean. Browser verification confirmed default grid render, toggle → list markup, `aria-pressed` flip, `localStorage` persistence across a simulated reload, and working Edit/Delete in both layouts with zero console errors.

## Lessons Learned

- **Reading the diff mattered even for a "simple" task.** Both agents reported clean lint/format, but a direct `prettier --check` afterward found the test-writing agent's file had actual formatting violations (long lines from parameterized `describe.each` blocks) that its own self-reported "pass" had missed. Worth running the formatter yourself as a final gate especially on small, well-specified tasks — that's exactly where it's tempting to skip.
- **Splitting "implementation" from "tests" into separate sequential agents worked well for a single-component change.** The test agent needed the real implementation to exist first; two sequential handoffs was the right granularity — not so small orchestration overhead dominated, not so large either agent had to hold unrelated concerns.
- **Giving each agent the literal current file contents inline (not just a path) avoided drift.** Both prompts embedded the actual `.ts`/`.html`/`.scss` contents and actual `ButtonDirective`/`IconComponent`/`ThemeService` shapes, so agents implemented against a concrete baseline instead of exploring the codebase first.
- **Browser verification caught nothing the tests didn't already cover — still a useful data point.** jsdom TestBed tests already asserted class presence, `aria-pressed`, and click-through. The real-browser Playwright pass confirmed the same under an actual Chromium render, plus surfaced things unit tests structurally can't: zero console errors, visually sane layout (row alignment, divider borders, truncation), and persistence across an actual full-page `reload()` rather than a fresh `TestBed.createComponent`. Worth doing even when you expect it'll just confirm the tests.
- **No `chromium-cli` on this Windows dev box.** The `run` skill's pattern assumes a Linux container with `chromium-cli` preinstalled; fell back to `npx playwright` (needed a one-time `playwright install chromium`) plus a small one-off script. Playwright-via-npx is the working fallback on this machine.
- **H2 in-memory DB meant zero manual cleanup after browser verification.** Seeded two throwaway recipes via `POST /recipes`; killing the backend process wiped the database automatically — no cleanup code needed for future ad hoc verification passes.
