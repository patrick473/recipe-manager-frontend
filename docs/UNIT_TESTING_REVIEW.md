# Frontend Unit Testing — Review (2026-08-03)

Audit of the current state of `recipe-manager-frontend` unit testing, run
after [UNIT_TESTING_SPEC.md](./UNIT_TESTING_SPEC.md)'s P0/P1 rollout landed
(see [UNIT_TESTING_IMPLEMENTATION_NOTES.md](./UNIT_TESTING_IMPLEMENTATION_NOTES.md)).
This doc is a snapshot assessment, not a new implementation plan — where it
finds gaps, it points back at the spec's own conventions rather than
inventing new ones.

## Headline numbers

- 21 spec files, 288 `it`/`describe` blocks, all colocated as `*.spec.ts`.
- 90.4% line coverage overall (`coverage/recipe-manager-frontend/lcov.info`),
  V8 provider via `vitest-base.config.ts`, generated API client excluded.
- Runner: Vitest through `@angular/build:unit-test` — confirmed still the
  only way to run a single file (`npx ng test --include=<path> --watch=false`;
  bare `npx vitest run` fails with `Need to call TestBed.initTestEnvironment()
  first`, per the implementation notes).
- CI (`.github/workflows/ci.yml`) runs `npm run lint`, `format:check`, and
  `npm test -- --watch=false` on every push/PR to `main`. The `e2e` job in
  the same workflow is gated `if: false` — Playwright tests exist and pass
  locally but are not yet wired into CI.

## What's solid

The spec's stated conventions are followed consistently across all 21 files:

- Services and interceptors test against `HttpTestingController` via
  `provideHttpClientTesting()` — one HTTP-mocking pattern, no ad hoc
  `fetch`/`XMLHttpRequest` stubbing anywhere.
- Components are tested with real `TestBed` + `ComponentFixture`, not
  shallow-render helpers, matching the app's `inject()`-based DI.
- Signal state is asserted by calling signals directly
  (`component['recipes']()`), reserving `fixture.detectChanges()` + DOM
  queries for tests actually about template rendering — e.g.
  `confirm-dialog.component.spec.ts` checks `role="alertdialog"` presence,
  `properties-panel.component.spec.ts` checks `.properties-body` presence.
- Error-path coverage is genuinely behavioral, not just line-filling:
  `auth.interceptor.spec.ts` distinguishes a 401 on an authenticated
  endpoint (logout + redirect) from a 401 on `/auth/login` itself (bad
  credentials, no logout) — the exact kind of edge case that's easy to get
  wrong and easy to skip in a spec.
- Test names read as behavior (`'omits the Authorization header for
  /auth/login even when a token is present'`), not implementation detail.

## Gaps

**`markdown-editor.component.ts` — 372 lines, 63% covered, zero spec file.**
This is the largest untested surface in the app. It landed the day after the
testing spec was written (`8bce85e`, one commit after `1b5dce6 add unit
tests`), so its absence from `UNIT_TESTING_SPEC.md` is a timing gap, not a
deliberate exclusion. Two things inside it are pure functions and cheap to
test in isolation without any CodeMirror/`EditorView` mounting:

- `toggleWrap()` ([markdown-editor.component.ts:167](../src/app/shared/markdown-editor/markdown-editor.component.ts#L167)) —
  wrap/unwrap-on-toggle logic (bold/italic), currently only exercised
  end-to-end through keybindings.
- `buildLivePreviewDecorations()` and `addLineDecorations()`
  ([markdown-editor.component.ts:47](../src/app/shared/markdown-editor/markdown-editor.component.ts#L47),
  [:70](../src/app/shared/markdown-editor/markdown-editor.component.ts#L70)) —
  the Obsidian-style "dim marks off the active line" behavior, the one
  piece of custom rendering logic in the file. Testable by constructing an
  `EditorState`/`EditorView` directly (no Angular `TestBed` needed) and
  asserting on the resulting `DecorationSet`.

The `ControlValueAccessor` wiring (`writeValue`, `registerOnChange`,
`setDisabledState`) and lifecycle (`ngAfterViewInit`/`ngOnDestroy`) do need
a mounted component and are more expensive to test — lower priority than
the two pure functions above, but currently at 0%.

**`properties-panel.component.ts` — 58% covered, spec only exercises
`expand()`.** The component has real, non-trivial logic that's entirely
untested:

- `addTag()` ([properties-panel.component.ts:85](../src/app/shared/properties-panel/properties-panel.component.ts#L85)) —
  trims input, no-ops on empty string, de-dupes against existing tags, and
  enforces the `MAX_TAGS = 20` ceiling that mirrors a backend
  `@Size(max = 20)` constraint. That backend/frontend mirroring is exactly
  the kind of contract worth locking down with a test, per the same
  reasoning the spec already applied to `recipe-form`'s field-validation
  messages.
- `onNewTagKeydown()` — Enter/comma both add a tag and clear the input;
  every other key is a no-op.
- `filteredSuggestions` — excludes tags already applied.
- `parseNumberInput()` — empty string and non-numeric input both coerce to
  `null` rather than `NaN` or `0`, for `prepTimeMinutes`/`cookTimeMinutes`/`servings`.

**`loader.component.ts` — 22% covered, no spec, consistent with the spec's
own call.** `UNIT_TESTING_SPEC.md` explicitly marked `loader`/`icon` as
"skip if no branching logic beyond interpolating inputs into the template."
That's still true here — the only branch is `size() === 'l'` toggling a
CSS class and `@if (text())` — so the low number reflects an intentional
decision, not an oversight. Flagging only so it isn't mistaken for drift
next time coverage is reviewed.

**E2E job disabled in CI.** `E2E_TESTING_SPEC.md`'s suite exists (12 spec
files under `e2e/tests/`) and the workflow has a full `e2e` job defined, but
it's gated `if: false`. Out of scope for a unit-testing review strictly
speaking, but worth flagging since it means the only thing actually gating
merges to `main` today is unit tests + lint + format.

## Suggested next steps, roughly in order

1. Add `markdown-editor.component.spec.ts` covering `toggleWrap()` and
   `buildLivePreviewDecorations()` as pure-function tests (no `TestBed`) —
   highest coverage return for the lowest test-infrastructure cost.
2. Extend `properties-panel.component.spec.ts` with the `addTag`/tag-limit/
   keydown/`parseNumberInput` cases above.
3. Decide whether to enable the `e2e` CI job or remove the dead `if: false`
   scaffold — leaving it as-is silently understates what CI actually
   verifies.
