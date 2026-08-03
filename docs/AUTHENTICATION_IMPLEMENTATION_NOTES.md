# Authentication & Per-User Recipes Implementation — Summary & Lessons Learned

Notes from implementing `AUTHENTICATION_SPEC.md` (2026-08-01).

## Summary

**Task:** Spring Security + JWT auth, recipes scoped to `userId`,
login/register on the frontend — the biggest architectural change on the
backlog, across both repos.

**Approach:** Per [[feedback_subagent_orchestration]], the spec's
"Suggested sequencing" described a strict chain with one explicit grouping
call-out (Parts 1-3, the backend account/token/enforcement work, have "no
useful intermediate state" and land together); dispatched as one subagent
per stage, strictly sequential: backend (Parts 1-3) → OpenAPI/client regen →
`AuthService`/interceptor → login/register UI/guard/nav bar.

**Result:** Backend 95/95 tests, frontend 215/215 tests, build/lint/format
clean. E2e: 7/12 passing, 4 pre-existing failures unrelated to auth.

**Notable catches:**

- `spring-boot-starter-security` landing on the classpath auto-secures
  `@WebMvcTest` slices before `SecurityConfig` even exists, breaking
  `RecipeControllerTest`. A `@Component`-annotated `JwtAuthenticationFilter`
  also gets pulled into the type-scan and drags in missing dependencies.
  Fixed by having `SecurityConfig` construct the filter directly instead of
  exposing it as an injectable bean, and `@Import`-ing `SecurityConfig` +
  the `ProblemDetail` handlers into the test slice.
- Spring Security 7.1.0 (Spring Boot 4.1.0) narrowed `DaoAuthenticationProvider`'s
  API — no no-arg constructor + setter, the `UserDetailsService` goes
  straight into the constructor.
- `Recipe.owner` `NOT NULL` broke `DataSeeder` (not mentioned in the spec);
  fixed with a dedicated seed-data account.
- That fix was incomplete: the original design also scoped `findAll`/
  `findById`/`loadImage` to the owner, so seeded/other-account recipes were
  invisible to everyone else. Revised so only mutations are owner-scoped;
  reads are unscoped. `RecipeSpecifications.hasOwner` removed as dead code.
- Unrelated latent bug surfaced by new test coverage:
  `RecipeService.create()`/`update()` set the `tags` collection to
  immutable `List.of()` — no prior test exercised a real `PUT` against the
  DB. Fixed with `new ArrayList<>(...)`.
- A stale backend process (started before this work) silently masked the
  new guarded behavior during e2e; needed a restart.
- Centralized "register-or-login before navigating" once in
  `e2e/fixtures/api.ts`'s shared fixture rather than duplicating it across
  six spec files as the spec's Testing section literally suggested.

## Follow-up: public reads (2026-08-01)

**Task:** Make `GET /recipes`, `GET /recipes/{id}`, and the image endpoint
work for a logged-out visitor, not just any authenticated account —
loosening the read boundary one step further than the original spec.

**Approach:** Backend `permitAll()` on the three GET paths → OpenAPI
`security: []` + client regen → frontend drops `authGuard` from
`recipes`/`recipes/:id`, gates New/Edit/Delete/Clone controls behind
`auth.isAuthenticated()` in templates (previously the route guard blocked
unauthenticated visitors before the button was ever rendered).

**Result:** Backend 100/100 tests, frontend 217/217 tests, clean
build/lint/format. New anonymous-access e2e spec (2/2 passing); same 4
pre-existing unrelated failures persist.

**Notable catches:**

- A locally running backend had a JDWP debug agent attached (`suspend=y`)
  and was serving stale pre-change behavior — more disruptive to restart
  than a plain `mvn spring-boot:run`, worth flagging to the user rather than
  silently killing it.
- `recipe-list.component.spec.ts`'s Edit/Delete DOM-wiring tests broke once
  those buttons became conditional on `auth.isAuthenticated()`: the suite's
  `beforeEach` clears `localStorage` and never mocks `AuthService`, so every
  test was actually exercising the logged-out render path. Fixed by seeding
  a fake `auth` localStorage entry in the fixture helper.
- The anonymous e2e case needed `browser.newContext()` directly (bypassing
  the shared fixture's auto-authenticated `page`) while still using the
  fixture's authenticated `api` for server-side setup/teardown.

## Lessons Learned

- A spec's own "no useful intermediate state" language should collapse
  multiple numbered parts into one subagent dispatch, not one-per-part —
  three sequential calls here would have left a red build in between for no
  benefit.
- When a spec was written before the code it depends on exists, tell
  downstream subagents to read the actual prior diff for exact names/shapes
  rather than trusting spec prose, which is a snapshot of intent.
- Framework-version specifics (an ORM's immutable-collection quirk, a
  security library's exact constructor signature) are where a
  detailed-but-generic spec most needs on-the-fly correction — budget for
  it rather than treating deviation as a red flag, as long as each
  deviation is a concrete, verified correction and not a reinterpretation
  of intent.
