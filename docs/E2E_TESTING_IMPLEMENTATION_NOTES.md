# E2E Testing Spec Implementation — Summary & Lessons Learned

Notes from implementing `E2E_TESTING_SPEC.md` (2026-07-25).

## Summary

**Task:** Stand up the Playwright E2E suite from scratch — no dependency,
directory, or config existed beforehand.

**Approach:** Single sequential pass, not parallel subagents — config,
fixtures, page objects, and specs form a strict dependency chain (a spec
needs a page object, a page object needs the component templates read, and
nothing runs without config + installed browser binaries), so there was
nothing to parallelize. Followed the spec's own "Rollout" order. Added a
shared `ConfirmDialogPage` (not in the spec's file layout) reused by both
list and detail delete flows rather than duplicating the
`role="alertdialog"` locator logic twice.

**Result:** 9 passing tests, 1 intentionally skipped (backend-down
messaging, per the spec's own suggestion to cover that in Vitest instead).
Lint/Prettier clean.

**Notable catches:**

- Reading the backend DTO (`RecipeRequest.java`'s `@NotBlank`) rather than
  just the OpenAPI doc revealed the client/server validation gap needed for
  a legitimate "backend-rejected submission" test: Angular's
  `Validators.required` doesn't trim, so a whitespace-only title passes
  client validation but fails the backend's `@NotBlank`, forcing a real 400
  round-trip with no mocking needed.
- Page objects reading `this.page` inside `readonly` field initializers hit
  `TS2729: used before its initialization` under this repo's
  `target: ES2022`/`useDefineForClassFields`. Fixed by moving locator
  construction into the constructor body.
- Playwright strict mode: a bare `getByText('flour')` matched both "flour"
  and "Mix the flour." in the CRUD spec's first draft. Fixed with
  non-overlapping fixture content and `{ exact: true }`.
- `e2e/tsconfig.json` couldn't reuse `tsconfig.spec.json` (wrong module
  target). `moduleResolution: "node"` failed on a missing `@types/node` and
  a TS6 deprecation warning; settled on `module: esnext` /
  `moduleResolution: bundler` plus adding `@types/node` as a dev dependency.
- The spec's proposed CI job runs `mvn spring-boot:run` from
  `../recipe-manager-backend`, but the frontend and backend are independent
  git repos and `actions/checkout@v4` only pulls the frontend — the sibling
  directory won't exist on a fresh runner. Flagged rather than silently
  "fixed," since the right fix is a CI-ownership call.
- `prettier --write` reordered imports in two already-reviewed files after
  the fact; re-ran the full suite post-format rather than trusting a
  formatting-only diff couldn't break anything.
- Added `.gitignore` entries for `/test-results/`, `/playwright-report/`,
  `/playwright/.cache/` up front — nothing ignored them before since
  neither existed pre-task.

## Lessons Learned

- Running a suite for real catches bugs (TS field-init ordering, Playwright
  strict-mode ambiguity) that reading the code wouldn't.
- Cross-repo assumptions baked into a spec's proposed CI/infra config are
  worth surfacing explicitly, not silently implementing or silently fixing.
- Re-run the full suite after an automated formatting pass — cheap
  insurance against an import reorder masking a real change.
