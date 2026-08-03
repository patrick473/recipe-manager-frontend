# Frontend Unit Testing Spec

Plan for bringing `recipe-manager-frontend/src` to solid unit test coverage.
Companion to [E2E_TESTING_SPEC.md](./E2E_TESTING_SPEC.md), kept as a separate
document/rollout because the two suites use different runners, run at
different speeds, and depend on different infrastructure — unit tests need
nothing but Node; E2E needs a live backend + browser.

Priority key: **P0** — core CRUD flows and shared primitives, do first ·
**P1** — secondary behavior (loading/error states, edge cases) · **P2** —
low-risk, nice-to-have coverage.

## Key decisions

- **Runner:** Vitest via `@angular/build:unit-test` (`npm test`). No
  Jasmine/Karma — the README is stale on this point per `CLAUDE.md`.
- Test files colocated with source as `*.spec.ts`.
- Component tests use `TestBed` + `ComponentFixture`, not shallow-rendering
  helpers — matches the codebase's `inject()`-based DI.
- HTTP-touching code (`RecipeService`) is tested against
  `HttpTestingController`; components that _consume_ `RecipeService` are
  tested with a **fake/stub service** instead, so component specs assert
  component behavior (signal state, template bindings, navigation) rather
  than re-verifying HTTP wiring already covered elsewhere.
- Signals are asserted by calling them directly, not via
  `fixture.detectChanges()` + DOM scraping, except where the test's actual
  subject is template rendering.
- `Router`/`ActivatedRoute` are stubbed with lightweight fakes rather than
  pulling in the full `app.routes.ts` config, unless a test needs real route
  resolution.
- Test descriptions read as behavior, not implementation.
- No snapshot testing — explicit assertions stay readable at this app's size
  and snapshots bit-rot silently.

## Shape of the change

- **P0 services:** extended `RecipeService` spec (`getById`, `create`,
  `update`); new specs for `ConfirmDialogService` — including its one
  non-obvious behavior, that calling `confirm()` again while a request is
  pending completes the previous `Subject` rather than leaking it —
  `ThemeService` (localStorage-vs-`prefers-color-scheme` precedence,
  `toggle()`/`set()`), and `apiBaseUrlInterceptor` (relative vs. absolute
  URL passthrough).
- **P0 route components** — the CRUD user journeys: `recipe-list`
  (load/error states, delete with confirm/cancel, in-flight `deleting()`
  flag), `recipe-detail` (route-param load, sanitized markdown rendering via
  `DomSanitizer`, 404-specific vs. generic error messaging, delete flow),
  `recipe-form` (create vs. edit mode, field patching incl.
  `description: null` → `''` coercion, validation, and the field-level
  backend-validation-error rendering contract on a 400 response).
- **P1 shell/shared UI:** `nav-bar` (expand toggle, theme delegation),
  `confirm-dialog` component (backdrop vs. inner-click dismissal,
  `role="alertdialog"`/`aria-modal` — also the accessible-selector contract
  the Playwright suite relies on), `button.directive` (appearance/size/
  `iconOnly` host-class toggling, including the `booleanAttribute`
  transform).
- **P2:** `icon`/`loader` — only worth dedicated specs if branching logic
  grows beyond template interpolation; otherwise skip and rely on E2E +
  host-component specs to catch regressions.

## Out of scope

- `app.config.ts` / `app.routes.ts` — configuration, not logic; covered
  indirectly by E2E navigation tests.
- Generated API client (`src/app/api/generated/**`) — generated code.
- Visual regression / pixel-level styling.

## CI

No frontend CI workflow exists yet (the backend has
`.github/workflows/ci.yml`; nothing analogous under
`recipe-manager-frontend/`). Once P0 coverage lands, add a mirroring
`recipe-manager-frontend/.github/workflows/ci.yml` (checkout, Node 22 setup,
`npm ci`, lint, format:check, `npm test -- --run`) — a follow-up once
coverage exists, not a blocker to writing the tests themselves.
