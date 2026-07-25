# Frontend Unit Testing Spec

Implementation plan for bringing `recipe-manager-frontend/src` to solid unit
test coverage. Companion to [E2E_TESTING_SPEC.md](./E2E_TESTING_SPEC.md),
which covers Playwright-driven integration/E2E tests — kept as a separate
document/rollout because the two suites use different runners, run at
different speeds, and depend on different infrastructure (unit tests need
nothing but Node; E2E needs a live backend + browser). See that doc for why
the split, and for the rationale on shared conventions.

**Current state:** one spec file exists,
[recipe.service.spec.ts](../src/app/services/recipe.service.spec.ts),
covering `RecipeService`. Every component, the remaining two services, the
one directive, and the one interceptor have zero coverage. The Vitest-based
`@angular/build:unit-test` builder is already wired (`angular.json`
`architect.test`, `tsconfig.spec.json`) — no new tooling is required to start
writing tests, only test files.

Priority key: **P0** — core CRUD flows and shared primitives, do first ·
**P1** — secondary behavior (loading/error states, edge cases) · **P2** —
low-risk, nice-to-have coverage.

---

## Stack & conventions

- Runner: Vitest via `@angular/build:unit-test` (`npm test` /
  `npx vitest run <path>`). No Jasmine/Karma — the README is stale on this
  point per `CLAUDE.md`.
- Test files are colocated with source as `*.spec.ts` (matches the existing
  `recipe.service.spec.ts` and `tsconfig.spec.json`'s default include glob).
- Component tests use `TestBed` + `ComponentFixture`, not shallow rendering
  helpers — this is the standard Angular approach and what the codebase's
  `inject()`-based DI expects.
- HTTP-touching code (`RecipeService`) is tested against
  `HttpTestingController` via `provideHttpClientTesting()`, per the existing
  file — keep using this pattern, don't introduce a second HTTP-mocking
  approach (e.g. `fetch-mock`).
- Components that consume `RecipeService` are tested with a **fake/stub
  `RecipeService`** (provided via `{ provide: RecipeService, useValue: ... }`
  or a minimal test double), not `HttpTestingController` — component specs
  should assert component behavior (signal state, template bindings,
  navigation calls), not re-verify HTTP wiring that's already covered by
  `recipe.service.spec.ts`.
- Signals are asserted by calling them directly (`component.recipes()`), not
  through `fixture.detectChanges()` + DOM scraping, except where the test's
  actual subject is template rendering (e.g. "the error message renders in
  the DOM").
- `Router`/`ActivatedRoute` are stubbed with lightweight fakes (a plain
  object satisfying the subset of the interface used, or
  `RouterTestingHarness` for navigation-outcome assertions) — avoid pulling
  in the full router config from `app.routes.ts` unless a test specifically
  needs route resolution.
- Test descriptions read as behavior, not implementation (`'shows a 404
  message when the recipe does not exist'`, not `'sets error signal'`).
- No snapshot testing — the app is small enough that explicit assertions on
  signals/DOM stay readable, and snapshots tend to bit-rot silently.

## File organization

```text
src/app/
  services/
    recipe.service.spec.ts        (exists)
    theme.service.spec.ts         (new)
  shared/
    confirm-dialog/
      confirm-dialog.service.spec.ts   (new)
      confirm-dialog.component.spec.ts (new)
    button.directive.spec.ts      (new)
    icon/icon.component.spec.ts   (new)
    loader/loader.component.spec.ts (new, if logic beyond a pure template exists)
  interceptors/
    api-base-url.interceptor.spec.ts (new)
  components/
    recipe-list/recipe-list.component.spec.ts   (new)
    recipe-detail/recipe-detail.component.spec.ts (new)
    recipe-form/recipe-form.component.spec.ts   (new)
    nav-bar/nav-bar.component.spec.ts (new)
```

## Scope, by file

### P0 — Services & core logic

**`services/recipe.service.ts`** (extend the existing spec file)

- [ ] `getById()` success and 404 passthrough
- [ ] `create()` posts the request body and returns the created `Recipe`
- [ ] `update()` puts to `/recipes/:id` and returns the updated `Recipe`
- [ ] Existing `getAll()` / `delete()` / `deleteWithConfirm()` cases stay as-is

**`shared/confirm-dialog/confirm-dialog.service.ts`**

- [ ] `confirm()` sets `request()` with defaults applied (`yes: 'Confirm'`,
      `no: 'Cancel'`, `content: ''`) when omitted from `ConfirmOptions`
- [ ] `respond(true)` / `respond(false)` emits on the observable returned by
      `confirm()` and clears `request()` back to `null`
- [ ] Calling `confirm()` again while a request is pending completes the
      previous `Subject` (no leaked/duplicate emissions) — this is the one
      non-obvious behavior in the file ([confirm-dialog.service.ts:20](../src/app/shared/confirm-dialog/confirm-dialog.service.ts#L20))

**`services/theme.service.ts`**

- [ ] `initialDarkMode()` precedence: `localStorage['theme']` wins over
      `prefers-color-scheme` when set to `'dark'` or `'light'`; falls back to
      `matchMedia` when unset — mock both `localStorage` and
      `window.matchMedia` per case
- [ ] `toggle()` flips `darkMode()` and persists to `localStorage`
- [ ] `set()` updates the `data-theme` attribute on `document.documentElement`

**`interceptors/api-base-url.interceptor.ts`**

- [ ] Relative URL (`/recipes`) gets `environment.apiUrl` prepended
- [ ] Absolute URL (`http://...` / `https://...`) passes through unchanged
      — test via `HttpTestingController` with `provideHttpClient(withInterceptors([apiBaseUrlInterceptor]))`

### P0 — Route components (the CRUD surface)

**`components/recipe-list/recipe-list.component.ts`**

- [ ] `ngOnInit` loads recipes into `recipes()`, flips `loading()` false
- [ ] Load failure sets `error()` and `loading()` false (stub `getAll()` to
      error)
- [ ] `deleteRecipe()`: on confirmed delete, removes the recipe from
      `recipes()`; on cancelled delete (`deleteWithConfirm` resolves
      `false`), list is unchanged
- [ ] `deleting()` is set to the recipe id while the delete is in flight
      (assert via the callback passed to `deleteWithConfirm`)
- [ ] Delete failure sets `error()` with the recipe's title interpolated,
      clears `deleting()`

**`components/recipe-detail/recipe-detail.component.ts`**

- [ ] `ngOnInit` reads `:id` from the route, loads the recipe, and sets
      `renderedContent()` from `marked.parse()` output wrapped via
      `DomSanitizer.bypassSecurityTrustHtml` — assert `sanitizer.bypassSecurityTrustHtml`
      is called with the parsed HTML string (stub `DomSanitizer` or use
      Angular's testing sanitizer)
- [ ] 404 error path sets the `Recipe #{id} was not found.` message
      specifically ([recipe-detail.component.ts:62](../src/app/components/recipe-detail/recipe-detail.component.ts#L62)); non-404 errors get the
      generic message
- [ ] `deleteRecipe()` navigates to `/recipes` on confirmed delete, does
      nothing (no navigation) when cancelled, and sets `error()` +
      `deleting(false)` on failure

**`components/recipe-form/recipe-form.component.ts`**

- [ ] Create mode (no `:id` param): `isEdit()` stays `false`, form starts
      empty, submit calls `recipeService.create()`
- [ ] Edit mode (`:id` present): `isEdit()` true, form is patched from
      `getById()` response (including `description: null` → `''` coercion),
      submit calls `recipeService.update(id, ...)`
- [ ] Edit-mode load failure sets `loadError()` with the id interpolated
- [ ] `onSubmit()` is a no-op and calls `markAllAsTouched()` when the form is
      invalid (required `title`/`content`, `title` maxlength 255)
- [ ] Successful submit navigates to `/recipes/:id` using the saved
      recipe's id
- [ ] Submit failure with a `400` + `err.error.errors` body renders the
      per-field validation message join
      ([recipe-form.component.ts:116-120](../src/app/components/recipe-form/recipe-form.component.ts#L116-L120)) — this
      is the field-level backend-validation contract worth locking down
      explicitly
- [ ] Non-400 submit failure sets the generic `submitError()` message
- [ ] `isInvalid()` / `titleError` getter cover both the `required` and
      `maxlength` messages

### P1 — Shell & shared UI

**`components/nav-bar/nav-bar.component.ts`**

- [ ] `toggleExpanded()` flips `expanded()`
- [ ] `toggleTheme()` delegates to `ThemeService.toggle()` (stub the service)

**`shared/confirm-dialog/confirm-dialog.component.ts`**

- [ ] Renders nothing when `service.request()` is `null`
- [ ] Renders the dialog with `req.label`/`req.content`/`req.yes`/`req.no`
      when a request is pending, with `role="alertdialog"` and
      `aria-modal="true"` present (this is also the accessible-selector
      contract the Playwright suite will rely on — see
      [E2E_TESTING_SPEC.md](./E2E_TESTING_SPEC.md))
- [ ] Clicking the backdrop calls `respond(false)`; clicking inside the
      dialog does not (stopPropagation)
- [ ] Clicking the confirm/cancel buttons calls `respond(true)`/`respond(false)`

**`shared/button.directive.ts`**

- [ ] Each `appearance` input value toggles exactly the matching
      `btn-*` host class
- [ ] `size` and `iconOnly` toggle `btn-s`/`btn-icon` correctly, including
      the `booleanAttribute` transform on `iconOnly` (e.g. `iconOnly=""`
      resolves to `true`)

### P2 — Low-risk presentational components

**`shared/icon/icon.component.ts`**, **`shared/loader/loader.component.ts`**

- [ ] Only worth a spec if there's branching logic beyond interpolating
      `name()`/`size()` into the template — if these stay pure/presentational,
      skip dedicated specs and rely on the E2E suite + host-component specs
      to catch regressions. Re-evaluate if they grow logic.

## Out of scope

- `app.config.ts` / `app.routes.ts` — configuration, not logic; covered
  indirectly by E2E navigation tests.
- Generated API client (`src/app/api/generated/**`) — generated code, not
  hand-written; don't write specs against it directly.
- Visual regression / pixel-level styling — not part of this spec.

## Commands

```bash
npm test                                                   # full suite
npx vitest run src/app/services/recipe.service.spec.ts     # single file
npx vitest run -t "confirm-dialog"                         # by name
npx vitest watch                                            # watch mode
```

## CI

No frontend CI workflow currently exists (the backend has
`.github/workflows/ci.yml`; nothing analogous under
`recipe-manager-frontend/`). Once P0 coverage above lands, add
`recipe-manager-frontend/.github/workflows/ci.yml` mirroring the backend's
shape:

```yaml
name: Frontend CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: recipe-manager-frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: recipe-manager-frontend/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm run format:check
      - run: npm test -- --run
```

(`--run` disables Vitest's watch mode in CI; confirm the exact flag once
`@angular/build:unit-test`'s CLI passthrough is checked against the
installed version.) This is a follow-up once coverage exists, not a
blocker to writing the tests themselves.

## Rollout

1. P0 services (`RecipeService` gaps, `ConfirmDialogService`, `ThemeService`,
   interceptor) — fast, no TestBed component wiring, de-risks the rest.
2. P0 route components (list/detail/form) — the actual CRUD user journeys.
3. P1 shell/shared UI.
4. Wire CI.
5. P2 presentational components, opportunistically.
