# E2E Testing Spec Implementation — Summary & Lessons Learned

Notes from implementing `E2E_TESTING_SPEC.md` (2026-07-25). Kept alongside
the spec for future reference on _how_ the suite got built and what tripped
it up along the way, not just what exists (the spec doc's own checklist
covers that).

## Summary

**Task:** Stand up the Playwright E2E suite from scratch per
`E2E_TESTING_SPEC.md` — no `@playwright/test` dependency, no `e2e/`
directory, no config existed beforehand.

**Approach:** Done as a single sequential pass rather than parallel
subagents, unlike the earlier unit-testing spec. That work split cleanly
into three file-ownership groups that could run concurrently; this one
couldn't — config, fixtures, page objects, and specs form a strict
dependency chain (you can't write a spec against a page object that
doesn't exist yet, can't write a page object without having read the
component templates, can't run anything without the config and installed
browser binaries), so there was nothing to meaningfully parallelize.

Order followed the spec's own "Rollout" section: installed
`@playwright/test` and Chromium (backgrounded, since the browser download
is the one slow step); scaffolded `playwright.config.ts` and
`e2e/tsconfig.json`; wrote `fixtures/api.ts` (seed/delete helpers plus a
`test.extend` fixture exposing an `APIRequestContext`); wrote page objects
for list/detail/form plus a shared `ConfirmDialogPage` (reused by both the
list and detail delete flows — not called out as a separate file in the
spec's directory layout, but avoided duplicating the
`role="alertdialog"` locator logic twice); wrote all 5 P0/P1 spec files;
wired the ESLint ignore and CI job; then actually ran the suite against
the real backend/frontend (both were already up locally via the
`.vscode/tasks.json` compound task, so Playwright's
`reuseExistingServer` reused them instead of double-starting).

**Result:** 9 passing tests, 1 intentionally skipped (backend-down
messaging, per the spec's own suggestion to cover that in Vitest instead).
Lint and Prettier clean.

## Lessons Learned

**Reading the backend DTO source, not just the OpenAPI doc, was necessary
to write a legitimate "backend-rejected submission" test.** The spec asks
for this "if feasible to trigger from the UI." `RecipeRequest.java` uses
`@NotBlank` on `title`/`content`, while the frontend's
`Validators.required` only checks for an empty string — it doesn't trim.
That gap is exactly the hook: submitting a whitespace-only title passes
Angular's client-side validation but fails the backend's `@NotBlank`,
forcing a real 400 round-trip through `recipe-form.component.ts`'s
error-joining logic without needing to mock anything or special-case the
test. Wouldn't have found this by reading the frontend alone.

**Running the suite for real caught two bugs that reading the code
wouldn't have.** Both were invisible until actual execution:

- _TypeScript field-initializer ordering._ Page objects that read
  `this.page` (a constructor parameter property) inside `readonly` field
  initializers failed with `TS2729: used before its initialization` — a
  consequence of `target: ES2022`'s `useDefineForClassFields` semantics,
  where class field initializers run in declaration order and a parameter
  property isn't guaranteed to be assigned first. Fixed by moving all
  locator construction into the constructor _body_ instead of field
  initializers. Worth remembering for any future Page Object Model code in
  this repo's TS config.
- _Playwright strict-mode duplicity._ The CRUD spec's first draft used
  recipe content containing both "flour" and "Mix the flour." — a bare
  `getByText('flour')` matched both, failing strict mode. Fixed by using
  non-overlapping content strings and `{ exact: true }`. A reminder that
  E2E test fixtures need the same "make it unambiguous" discipline as the
  selectors themselves.

**`e2e/tsconfig.json` needed real thought, not a copy-paste of an existing
tsconfig.** `tsconfig.spec.json` wasn't reusable (wrong module target for
Playwright's runner), and the first attempt (`moduleResolution: "node"`)
both failed on a missing `@types/node` (not previously a dependency
anywhere in this frontend-only repo) and hit a TS6-deprecation warning for
that resolution mode. Settled on `module: esnext` /
`moduleResolution: bundler` plus adding `@types/node` as a dev dependency
— modern equivalents that don't warn under this repo's TypeScript version.

**The spec's own proposed CI job has a gap the spec doesn't mention:** its
`webServer` config runs `mvn spring-boot:run` from `../recipe-manager-backend`,
but per `CLAUDE.md` this workspace is two _independent_ git repos, and the
CI job's `actions/checkout@v4` only pulls the frontend one. On a fresh
runner, the sibling directory the config depends on simply won't exist.
This was flagged rather than silently "fixed," since the right fix (a
second checkout step against `patrick473/recipe-manager-backend`, or
something else entirely) is a call for whoever owns CI, not something to
guess at. General principle: implementing a spec's proposed CI/infra
config verbatim is fine, but cross-repo assumptions baked into it are
worth surfacing explicitly rather than assuming they were already
verified.

**Formatting tools can silently change files after you've already
"finished" them.** `prettier --write` (via `prettier-plugin-organize-imports`)
reordered imports in two files — `fixtures/api.ts` and
`recipe-crud.spec.ts` — that had already been written and manually
reviewed. Re-running the full suite after the format pass (not just
trusting that a formatting-only diff couldn't break anything) was the
right call, cheap insurance against, e.g., an import reorder masking a
typo.

**Nothing in the repo ignored Playwright's own output directories.**
`.gitignore` had no entry for `test-results/` or `playwright-report/` —
unsurprising since neither existed before this task, but easy to miss
since the spec doc doesn't call it out explicitly (it's implied by "the
suite runs and produces reports/traces"). Added
`/test-results/`, `/playwright-report/`, `/playwright/.cache/` up front
rather than after they accidentally landed in a commit.
