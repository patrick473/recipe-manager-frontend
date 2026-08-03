# Frontend E2E / Integration Testing Spec (Playwright)

Plan for a Playwright suite exercising the real frontend against a real
backend (no HTTP mocking). Companion to
[UNIT_TESTING_SPEC.md](./UNIT_TESTING_SPEC.md) — kept separate because the
two suites are effectively different projects: unit (Vitest) tests
components/services in isolation with HTTP mocked, runs in milliseconds,
lives colocated under `src/`; E2E (Playwright) runs the full stack
(`ng serve` + real Spring Boot API + H2), runs in seconds, lives in a new
top-level `e2e/` directory outside `src/` so `tsconfig.spec.json`'s include
glob and Vitest's discovery don't collide with Playwright specs (and vice
versa). "Integration" and "E2E" are used interchangeably here — Playwright
only ever drives a real browser against running servers in this codebase,
there's no separate server-without-browser layer worth targeting.

**Key decisions:**

- **No dedicated test DB profile.** Backend runs against the same
  in-memory H2 dev config; each CI run restarts the backend fresh, which is
  enough isolation. Add a Spring test profile only if data collisions
  become an actual problem.
- **Tests own their cleanup**, since H2 state persists for the life of the
  backend process: unique recognizable titles (e.g. timestamped), delete
  what they created in `afterEach`/`afterAll`, and assert "my recipe is
  present" rather than exact list counts. `fixtures/api.ts` wraps the real
  API directly for setup/teardown that shouldn't go through the UI.
- **Accessibility-first selectors** (`getByRole`/`getByLabel`/`getByText`)
  over CSS/`data-testid` — mirrors the app's existing semantics (e.g. the
  confirm dialog's `role="alertdialog"`) and gets a11y coverage for free.
  Fall back to `data-testid` only where no accessible name/role exists and
  adding one isn't warranted — otherwise fix the missing label/role, since
  that's an a11y bug, not just a test inconvenience.
- **`playwright.config.ts`'s `webServer` boots both** the Angular dev
  server and `mvn spring-boot:run` and waits on both health checks, with
  `reuseExistingServer` so local runs reuse whatever's already up via
  `.vscode/tasks.json`.

## Scope

P0: `recipe-crud.spec.ts` (create → view → edit → delete full lifecycle),
`recipe-list.spec.ts` (empty/loaded states, delete-with-confirm),
`recipe-not-found.spec.ts` (bad id shows not-found message),
`recipe-validation.spec.ts` (empty-field/maxlength inline validation,
backend-rejected submission surfaces the joined error message). P1:
`theme-toggle.spec.ts` (persists across reload), unknown-route redirect.

**Out of scope:** cross-browser matrix (Chromium only for now),
visual-regression screenshots, load/performance testing.

## CI

Separate, slower-tier job from the unit-test/lint job (needs Java + Maven
for the backend plus Playwright's browser binaries) — installs Chromium,
runs `npx playwright test`, uploads the HTML report as an artifact.

## Rollout

Install Playwright → scaffold config/fixtures → P0 specs → P1 specs → wire
CI → revisit test-data isolation only if collisions actually occur.
