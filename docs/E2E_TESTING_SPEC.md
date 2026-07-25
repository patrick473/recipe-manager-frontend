# Frontend E2E / Integration Testing Spec (Playwright)

Implementation plan for a Playwright-driven integration test suite that
exercises the real frontend against a real backend (no HTTP mocking).
Companion to [UNIT_TESTING_SPEC.md](./UNIT_TESTING_SPEC.md) — kept as a
separate document because these two suites are effectively separate
projects glued to the same repo:

|                      | Unit (Vitest)                                  | E2E (Playwright)                                                                                                     |
| -------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Runs against         | Components/services in isolation, HTTP mocked  | Full stack: `ng serve` + real Spring Boot API + H2                                                                   |
| Speed                | Milliseconds per test                          | Seconds per test (real browser, real network)                                                                        |
| Catches              | Logic errors, edge cases, per-unit regressions | Wiring bugs across the frontend/backend contract, routing, real DOM/CSS interaction, a11y at the rendered-page level |
| New tooling required | None (already wired)                           | Yes — `@playwright/test` isn't installed yet                                                                         |
| Where it lives       | Colocated `*.spec.ts` under `src/`             | A new top-level `e2e/` directory, outside `src/`                                                                     |

Splitting them (rather than one "testing spec") means each can be scoped,
staffed, and run independently — e.g. unit tests run on every save in watch
mode, E2E runs pre-merge or nightly once the suite is non-trivial.

**Current state:** no Playwright dependency, no `e2e/` directory, no
`playwright.config.ts`. This is a from-scratch setup.

---

## Why "integration" here means Playwright E2E, not mid-layer integration tests

The ask was "integration tests using Playwright" — Playwright drives a real
browser against running servers, so in this codebase that's synonymous with
end-to-end tests (there's no separate app-server-without-browser layer worth
targeting; the frontend has no server-side rendering). This doc uses
"E2E" and "integration" interchangeably to mean the same thing: browser-driven
tests against the full stack.

## Setup

```bash
cd recipe-manager-frontend
npm install -D @playwright/test
npx playwright install --with-deps chromium   # add firefox/webkit later if needed
```

Add scripts to `package.json`:

```json
{
  "scripts": {
    "e2e": "playwright test",
    "e2e:ui": "playwright test --ui",
    "e2e:report": "playwright show-report"
  }
}
```

## Directory layout

Playwright specs must **not** live under `src/` — `tsconfig.spec.json`'s
include glob (and Vitest's default discovery) would otherwise pick up
`*.spec.ts` files meant for Playwright and try to run them as unit tests
(and vice versa, Playwright would try to run Vitest specs as E2E tests if
pointed at `src/`). Keep them fully separate:

```text
recipe-manager-frontend/
  e2e/
    playwright.config.ts        # or at repo root, see below
    tsconfig.json                # standalone, not tsconfig.spec.json
    fixtures/
      api.ts                    # test-owned helpers for seeding/cleaning via the real API
    pages/
      recipe-list.page.ts        # Page Object Models, one per route
      recipe-detail.page.ts
      recipe-form.page.ts
    tests/
      recipe-crud.spec.ts        # create → view → edit → delete happy path
      recipe-list.spec.ts        # empty state, loading, error state
      recipe-validation.spec.ts  # form validation, backend 400 mapping
      recipe-not-found.spec.ts   # 404 handling on /recipes/:id
      theme-toggle.spec.ts       # nav bar theme persistence
```

`playwright.config.ts` at `recipe-manager-frontend/playwright.config.ts`
(repo root of this subproject) with `testDir: './e2e/tests'` is simplest —
avoids needing a second `package.json`/`node_modules`.

## Backend dependency & test data isolation

This is the one genuinely new piece of infrastructure. The suite needs a
running backend on `:8080` (H2 in-memory per `CLAUDE.md`) and frontend on
`:4200`. Two things fall out of "real backend, in-memory DB, shared across
the whole test run":

1. **No dedicated test profile exists yet.** Backend switches DB purely via
   `application.properties` (`CLAUDE.md`) and there's no `application-test.properties`.
   For now, run against the same dev configuration — H2 in-memory resets
   automatically on process restart, which is enough isolation between CI
   runs (each CI run starts the backend fresh). If test-data collisions
   become a problem, that's the trigger to add a Spring profile that resets
   the DB per test run or per test, not before.
2. **Tests must not assume a clean/empty DB and must clean up after
   themselves.** Since H2 state persists for the life of the backend
   process (i.e. across all tests in a single `npm run e2e` invocation, and
   across repeated local runs if the backend isn't restarted), every test
   that creates a recipe must:
   - Use a unique, recognizable title (e.g. `` `E2E Test Recipe ${Date.now()}` ``)
     so tests never collide with each other or with hand-created dev data.
   - Delete what it created in an `afterEach`/`afterAll` (via the UI's own
     delete flow where the test is exercising delete anyway, or via a direct
     API call in `fixtures/api.ts` otherwise) so re-runs don't accumulate
     stale rows and so list-view assertions (e.g. "the list shows N items")
     stay meaningful.
   - Avoid asserting exact list counts/contents from `GET /recipes` — assert
     "the recipe I just created is present" (`getByText` scoped to a unique
     title), not "the list has exactly 3 items."

`fixtures/api.ts` should wrap the real API directly (`fetch`/`request`
context against `http://localhost:8080`) for setup/teardown that doesn't
need to go through the UI — e.g. seeding a recipe to test the detail/edit
page without re-testing the create flow every time.

## Selector strategy

Prefer Playwright's accessibility-first locators over CSS/`data-testid`:
`getByRole`, `getByLabel`, `getByText`. This mirrors the app's existing
semantics — e.g. the confirm dialog already renders `role="alertdialog"`
`aria-modal="true"` with a labelled heading
([confirm-dialog.component.ts:14-19](../src/app/shared/confirm-dialog/confirm-dialog.component.ts#L14-L19)) — and
gets basic accessibility coverage for free as a side effect of writing
selector-stable tests. Fall back to `data-testid` only where no accessible
name/role exists and adding one purely for test purposes isn't warranted;
prefer fixing the missing label/role instead (that's an accessibility bug,
not just a test-selector inconvenience).

## Config

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm start',
      cwd: '.',
      url: 'http://localhost:4200',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'mvn spring-boot:run',
      cwd: '../recipe-manager-backend',
      url: 'http://localhost:8080/swagger-ui.html',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
```

`webServer` as an array lets Playwright boot both the Angular dev server and
the Spring Boot API itself and wait for both health checks before running
tests — no separate "start both" step needed in CI, and locally
`reuseExistingServer` means it'll reuse whatever's already running from
`.vscode/tasks.json`'s "Start Backend + Frontend" task instead of double-starting.

## Scope — test scenarios

### P0 — Core CRUD journey

- [ ] **`recipe-crud.spec.ts`**: create a recipe via the form → redirected to
      its detail page → title/description/rendered Markdown content are
      visible → edit it via the form → changes reflected on detail → delete
      it via the confirm dialog → redirected to the list → recipe no longer
      present. One end-to-end test covering the full lifecycle plus cleanup
      via the delete step itself.

### P0 — Per-page behavior

- [ ] **`recipe-list.spec.ts`**
  - Empty/loaded states render (seed one recipe via `fixtures/api.ts`,
    assert it appears in the list)
  - Backend-down / load-failure messaging (harder to simulate against a
    real backend — consider routing this specific case through Vitest
    component tests instead per [UNIT_TESTING_SPEC.md](./UNIT_TESTING_SPEC.md)
    rather than forcing a real network failure in E2E)
  - Delete from the list: confirm dialog appears, cancel leaves the row,
    confirm removes it
- [ ] **`recipe-not-found.spec.ts`**: navigating to `/recipes/999999` (an id
      that doesn't exist) shows the "Recipe #999999 was not found." message
      ([recipe-detail.component.ts:62](../src/app/components/recipe-detail/recipe-detail.component.ts#L62))
- [ ] **`recipe-validation.spec.ts`**
  - Submitting the create form with an empty title/content shows inline
    validation and does not navigate away
  - Title over 255 characters shows the maxlength message
  - (If feasible to trigger from the UI) a backend-rejected submission
    surfaces the joined field-error message
    ([recipe-form.component.ts:116-120](../src/app/components/recipe-form/recipe-form.component.ts#L116-L120))

### P1 — Shell behavior

- [ ] **`theme-toggle.spec.ts`**: toggling the theme in the nav bar flips
      `document.documentElement`'s `data-theme` attribute and persists
      across a reload (`localStorage`)
- [ ] Client-side routing: unknown path (`/nonexistent`) redirects to
      `/recipes`

## Out of scope (for now)

- Cross-browser matrix (Firefox/WebKit) — start with Chromium only; add
  projects later if a browser-specific bug shows up.
- Visual regression screenshots — not requested, adds maintenance overhead
  disproportionate to a 4-route app.
- Load/performance testing — different tool, different spec.

## Lint/CI integration

- Add `e2e/` to `eslint.config.js`'s ignore list (or give it its own flat
  config block with `eslint-plugin-playwright`) so `npm run lint` doesn't
  try to apply Angular-template-project rules to Playwright test files.
- New CI job, separate from the unit-test job proposed in
  [UNIT_TESTING_SPEC.md](./UNIT_TESTING_SPEC.md#ci) (different runtime needs —
  Java + Maven for the backend, Playwright's browser binaries — and slower,
  so it shouldn't block fast feedback from unit tests/lint):

```yaml
e2e:
  runs-on: ubuntu-latest
  defaults:
    run:
      working-directory: recipe-manager-frontend
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        {
          node-version: 22,
          cache: npm,
          cache-dependency-path: recipe-manager-frontend/package-lock.json,
        }
    - uses: actions/setup-java@v4
      with: { distribution: temurin, java-version: '25', cache: maven }
    - run: npm ci
    - run: npx playwright install --with-deps chromium
    - run: npx playwright test
      env:
        CI: true
    - uses: actions/upload-artifact@v4
      if: always()
      with:
        name: playwright-report
        path: recipe-manager-frontend/playwright-report/
```

## Rollout

1. Install Playwright, scaffold `e2e/` + config, verify `webServer` boots
   both processes and a trivial smoke test (load `/recipes`, assert the nav
   bar renders) passes locally.
2. `fixtures/api.ts` seed/cleanup helpers.
3. P0 CRUD journey + per-page specs.
4. P1 shell behavior.
5. Wire the CI job; keep it separate from/slower-tier than unit tests + lint.
6. Revisit test-data isolation (dedicated backend test profile) only if
   collisions actually occur in practice.
