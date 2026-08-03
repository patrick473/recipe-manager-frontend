# Authentication & Per-User Recipes

Spec for [FUTURE_IDEAS.md](FUTURE_IDEAS.md) item 11: Spring Security + JWT,
recipes scoped to a `userId`, login/register on the frontend.

**Key decision:** "per-user" means _ownership_, not _visibility_. Every
recipe belongs to one account, but `GET /recipes`, `GET /recipes/{id}`, and
the hero-image endpoint are public — no auth header needed, readable by
anyone including logged-out visitors. Only mutation (create/edit/delete/
image) requires being signed in and being the owner. A recipe you don't own
returns 404 on a mutation attempt, not 403 (same as a nonexistent id) — the
API never confirms an id belongs to someone else.

This was revised twice after implementation: an earlier draft scoped reads
to "my recipes," which made the app's seed data (and every other account's
recipes) invisible to everyone else, defeating the point of a shared
library — see AUTHENTICATION_IMPLEMENTATION_NOTES.md. A later follow-up then
dropped the "must be signed in" requirement for reads entirely, so the list/
detail views work for a logged-out visitor too.

**Auth is stateless:** backend issues a self-signed JWT on login/register;
frontend stores `{ token, userId, username }` in `localStorage` (matching
this repo's existing plain-JSON localStorage convention) and attaches it as
`Bearer` via a new `HttpInterceptorFn`. Accepted tradeoff: XSS can read the
token (an httpOnly cookie would not), but it needs no CSRF handling and
matches the backlog's plain "JWT" wording.

**Explicitly out of scope:** OAuth/social login, email verification,
password reset, refresh-token rotation (fixed-expiry access token only,
re-login on expiry), roles/RBAC, collaborative editing across accounts,
rate-limiting `/auth/**`, and migrating pre-existing recipe rows in a
populated DB (this repo runs on ddl-auto=update + in-memory H2, so a
`NOT NULL` owner column is a non-issue in dev).

## Shape of the change

- **Backend:** new `User` entity (username + BCrypt password, no email),
  `POST /auth/register` / `POST /auth/login` returning
  `{ token, userId, username }`; `jjwt`-based `JwtService` +
  `JwtAuthenticationFilter`; `SecurityConfig` wiring stateless sessions, CORS
  (replacing the old `WebMvcConfigurer` CORS bean), `ProblemDetail`-shaped
  401/403 handlers, and `permitAll()` on the three GET read endpoints plus
  `/auth/**`. `Recipe` gains a `NOT NULL owner` FK; mutating service methods
  take an `ownerId` and 404 on mismatch; `findAll`/`findById`/`loadImage`
  stay unscoped.
- **Contract:** `openapi.yaml` gains `bearerAuth` security scheme (global,
  overridden to `security: []` on `/auth/**` and the three read ops), new
  auth paths/schemas; client regenerated via `npm run api:generate`.
- **Frontend:** `AuthService` (signals: `currentUser`, `token`,
  `isAuthenticated`) mirroring the existing `favorites.service.ts` idiom;
  `authInterceptor` attaches the bearer token and logs out + redirects to
  `/login` on any 401; `authGuard` protects only `recipes/new` and
  `recipes/:id/edit` (list/detail are ungated per the public-reads
  decision); login/register components; mutation controls (New Recipe,
  Edit, Delete, Clone) hidden via `@if (auth.isAuthenticated())` in nav bar,
  list, and detail — enforcement is still server-side, this is UI-only.

## Testing

Backend: `JwtServiceTest` (round-trip/expiry/tamper), `AuthControllerTest`
(register/login status codes), full-stack ownership test (two accounts,
cross-account read succeeds / mutation 404s), anonymous-caller read/mutation
cases. Frontend: `AuthService`/`authInterceptor`/`authGuard` unit tests,
login/register component tests, nav-bar/list/detail control-gating tests. E2e
via the shared `e2e/fixtures/api.ts` fixture (registers-and-logs-in by
default) plus a dedicated anonymous-context spec for logged-out access.

## Deferred

Refresh tokens, data migration for a real non-H2 deployment, collaborative
editing (multi-owner recipes), roles/admin, account settings (change
password/username, delete account).
