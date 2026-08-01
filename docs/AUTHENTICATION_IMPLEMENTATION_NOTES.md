# Authentication & Per-User Recipes Implementation — Summary & Lessons Learned

Notes from implementing `AUTHENTICATION_SPEC.md` (2026-08-01), kept
alongside the spec for future reference on _how_ the work happened, not
just what changed.

## Summary

**Task:** Ship `FUTURE_IDEAS.md` item 11 — Spring Security + JWT auth,
recipes scoped to a `userId`, login/register on the frontend. The biggest
architectural change on the backlog, spanning both repos across 6 spec
parts.

**Approach:** The spec's own "Suggested sequencing" section described a
strict dependency chain with one explicit grouping call-out: Parts 1-3
("there's no useful intermediate state where auth exists but nothing is
enforced yet") land together as one backend change, then Part 4 (OpenAPI +
client regen), then Part 5 (`AuthService`/interceptor), then Part 6
(login/register UI/guard/nav bar) — each strictly after the last, no pair
ever named as independent. Per [[feedback_subagent_orchestration]], that
reads as fully sequential: one subagent per stage, dispatched only after
the previous stage's diff landed and its test suite was green.

1. Backend Parts 1-3 in one subagent call: `User` entity, register/login,
   `JwtService`/`JwtAuthenticationFilter`, `SecurityConfig`, and
   per-user recipe ownership threaded through `RecipeService`/
   `RecipeController`, plus fixing the existing `RecipeControllerTest`/
   `RecipeControllerImageTest` that the spec's own baseline section warned
   would break the moment the security starter landed on the classpath.
2. Part 4: `openapi.yaml` + `npm run api:generate` + `auth.model.ts`,
   dispatched only after Parts 1-3's real DTOs existed to read field names
   from (rather than trusting spec prose alone).
3. Part 5: `AuthService` + `authInterceptor`, dispatched only after Part
   4's generated `auth` client existed to wrap.
4. Part 6: login/register components, `authGuard`, nav bar, and the e2e
   fixture updates, dispatched only after Part 5's `AuthService` API
   surface existed to build UI against.

**Result:** Backend: 95/95 tests passing (`mvn clean verify`). Frontend:
215/215 unit tests passing, `ng build`/`lint`/`format:check` clean. E2E
suite run live against a freshly restarted backend: 7/12 passing, 1
intentionally skipped, 4 pre-existing failures unrelated to auth (a
markdown-editor accessible-label gap and a pagination-query-param URL
regex, both predating this spec).

**Notable catches:**

- The spec's baseline section correctly predicted that
  `spring-boot-starter-security` landing on the classpath breaks
  `@WebMvcTest`-based `RecipeControllerTest` before `SecurityConfig` is
  even written (auto-secured slice) — but the fix needed more than the
  spec's literal "`.with(user(...))`" suggestion: a `@Component`-annotated
  `JwtAuthenticationFilter` gets pulled into the `@WebMvcTest` type-scan
  even without `SecurityConfig` imported, dragging in dependencies the
  slice doesn't provide. Fixed by having `SecurityConfig` construct the
  filter directly (`new JwtAuthenticationFilter(...)`) instead of exposing
  it as an injectable bean, and explicitly `@Import`-ing `SecurityConfig`
  plus the two `ProblemDetail` handlers into the test slice so
  `@AuthenticationPrincipal` resolves correctly and `BadCredentialsException`
  actually translates to a 401 via the real filter chain.
- Spring Security 7.1.0 (shipped with this repo's Spring Boot 4.1.0) has a
  narrower `DaoAuthenticationProvider` API than the spec assumed — no
  no-arg constructor + `setUserDetailsService(...)`; the constructor now
  takes the `UserDetailsService` directly. A framework-version reality the
  spec (written against general Spring Security knowledge) couldn't have
  pinned exactly.
- Making `Recipe.owner` `NOT NULL` broke `DataSeeder`, which the spec never
  mentioned — not in its "Files touched" list because seeding wasn't in
  scope for the spec's own text, but a real consequence of the schema
  change on app startup. Fixed with a dedicated seed-data account.
- That seed-data fix turned out to be incomplete: the original spec also
  scoped `findAll`/`findById`/`loadImage` to `hasOwner(ownerId)`, same as
  every mutating method. Combined with the seed-data account's
  intentionally-unreachable random password, this meant the 20 seeded
  recipes existed in the database but were invisible to every real
  account — starting the app and logging in as yourself always showed an
  empty list, regardless of what `DataSeeder` had inserted. More generally,
  the same strict scoping meant _any_ two accounts on the same instance
  could never see each other's recipes at all, not just the seed data.
  Revised the design after this was caught: reads (`findAll`/`findById`/
  `loadImage` in `RecipeService`, and the corresponding `RecipeController`
  endpoints) are no longer owner-scoped at all, while every mutation
  (`update`/`delete`/`uploadImage`/`deleteImage`) stays exclusive to the
  owner. `RecipeSpecifications.hasOwner` was removed as dead code once
  `findAll` no longer needed it. See `AUTHENTICATION_SPEC.md` Part 3, which
  was updated in place to describe this final behavior rather than the
  original all-private design.
- Unrelated latent bug surfaced by _new_ test coverage, not by the auth
  work itself: `RecipeService.create()`/`update()` set the `tags`
  `@ElementCollection` to the immutable `List.of()`. No prior test
  exercised `PUT /recipes/{id}` against a real database — only mocked-service
  tests and image-only full-stack tests existed — so this had been latent
  until the new full-stack ownership test became the first real update
  path through Hibernate's collection-merge logic. Fixed with
  `new ArrayList<>(...)`.
- The live backend process discovered while running e2e for Part 6 was
  stale — started before the auth work, so `/auth/register` 404'd and
  `/recipes` was still openly returning 200. Restarting it against current
  source was necessary before the e2e suite could exercise the real
  guarded behavior at all; a reminder that this repo's dev-server
  processes don't restart themselves and stale state can silently mask a
  broken assumption.
- Rather than duplicating "register-or-login before navigating" across all
  six existing e2e spec files as the spec's Testing section literally
  suggested ("every spec's setup needs a register-or-login step added"),
  the work centralized it once in `e2e/fixtures/api.ts`'s shared `page`/`api`
  fixture overrides, since five of the six specs already imported from that
  file. Same effect, no six-way duplication.

## Follow-up: public reads (2026-08-01)

**Task:** A follow-up request — "the recipes (overview and detail should be
visible for unauthenticated)" — to make `GET /recipes`, `GET /recipes/{id}`,
and `GET /recipes/{id}/image` work for a logged-out visitor, not just any
authenticated account. The original spec's "any authenticated account can
browse" design (see Part 3) was itself already a revision from an even
earlier "my recipes only" draft; this follow-up loosens the same boundary
one step further, dropping the sign-in requirement for reads entirely.

**Approach:** Backend first (`SecurityConfig`'s `authorizeHttpRequests` gains
a `permitAll()` matcher scoped to `HttpMethod.GET` on the three read paths,
ahead of the catch-all `anyRequest().authenticated()`), then `openapi.yaml`
(`security: []` on the three read operations, client regenerated), then
frontend (drop `authGuard` from the `recipes`/`recipes/:id` routes; gate the
New Recipe/Edit/Delete/Clone controls in `RecipeListComponent`,
`RecipeDetailComponent`, and `NavBarComponent` behind
`auth.isAuthenticated()` in the template, since the backend no longer 401s
those requests to fall back on — an unauthenticated caller would previously
have been blocked by the route guard before ever seeing the button; now the
button itself has to not exist).

**Result:** Backend: 100/100 tests passing (`mvn clean test`), including new
`RecipeControllerTest` cases (`listAllWithNoTokenSucceeds`,
`getByIdWithNoTokenSucceeds`) and new `RecipeOwnershipTest` anonymous-caller
cases (three reads succeed with no token; `POST`/`PUT`/`DELETE` all still
401 with no token). Frontend: 217/217 unit tests passing, lint/build/format
clean. E2e: new `recipe-anonymous-access.spec.ts` (2 tests, both passing)
plus the full existing suite re-run clean of regressions — the same 4
pre-existing failures from the original implementation (markdown-editor
accessible-label gap, pagination-query-param URL regex) are still present
and still unrelated to auth.

**Notable catches:**

- A backend dev server was running locally with a JDWP debug agent attached
  (`suspend=y`) — an IDE debug session, not just a stray `mvn spring-boot:run`
  — and it was serving stale, pre-change behavior (still 401ing anonymous
  `GET /recipes`). Per [[reference_dev_setup]]'s standing warning about stale
  `:8080` processes, this needed restarting before e2e could actually
  exercise the new behavior, but stopping a debug-attached process is more
  disruptive than stopping a plain run — worth flagging to the user rather
  than silently killing it next time this comes up.
- The existing `recipe-list.component.spec.ts` DOM-wiring tests for
  Edit/Delete (`describe.each(['grid', 'list'])('delete/edit DOM wiring...')`)
  broke the moment the buttons became conditional on `auth.isAuthenticated()`,
  because that suite's `beforeEach` calls `localStorage.clear()` and
  `AuthService` (never mocked in this spec file, unlike `nav-bar.component
.spec.ts`) reads real `localStorage` on construction — with no seeded
  session, every test in the file was actually exercising the _logged-out_
  render path. Fixed by seeding a fake `auth` localStorage entry (same shape
  `AuthService` itself persists) in that block's `createFixtureInMode`
  helper, plus one new test asserting the logged-out path explicitly hides
  Edit/Delete but keeps the favorite button.
- E2e coverage for "logged out" needed a different fixture shape than every
  other spec in the suite: `e2e/fixtures/api.ts`'s custom `test`/`page`
  always seed an authenticated session via `addInitScript`. The new spec
  instead takes the `browser` fixture (still available on the extended
  `test`) and calls `browser.newContext()` directly to get a page with no
  init script and no session, while still using the fixture's authenticated
  `api` to seed/clean up the recipe under test server-side — same pattern as
  every other spec for data setup, different pattern for the page under test.

## Lessons Learned

**A spec's own "no useful intermediate state" language is a stronger
sequencing signal than a generic dependency list, and should collapse
multiple numbered parts into one subagent dispatch, not one-per-part.**
Parts 1, 2, and 3 are numbered separately in the spec for expository
reasons (distinct concerns: account model, token issuance, enforcement)
but the spec explicitly says they have no useful landing point in between.
Treating that as "three sequential subagent calls" would have produced a
red build in between calls for no benefit — the correct read was "one
change, described in three parts for the reader's sake."

**When a spec was written before the code it depends on exists, tell
downstream subagents to read the actual prior diff, not just the spec
prose, for exact names/shapes.** Parts 4-6 all depend on artifacts (DTOs,
generated client methods, service APIs) that didn't exist until the
immediately preceding stage finished. Each subagent prompt explicitly
pointed at the real files the previous stage produced ("read the actual
generated auth.service.ts first... don't guess") rather than letting the
agent implement purely from the spec's prose, which is a snapshot of
intent written before any of that code existed and can't be trusted for
exact field names down to the character.

**Framework-version specifics (an ORM's immutable-collection quirk, a
security library's exact constructor signature) are where a
detailed-but-generic spec is most likely to need on-the-fly correction —
budget for it rather than treating spec deviation as a red flag.** Every
deviation reported across all four stages was a concrete, narrow
correction against something empirically verified (a compile error, a
failing test, an actual library API), not a reinterpretation of the
spec's intent. That's the right shape of deviation to accept without
pushing back to the user.
