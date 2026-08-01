# Authentication & Per-User Recipes

Design spec for [FUTURE_IDEAS.md](FUTURE_IDEAS.md) item 11: "currently fully
open; add Spring Security + JWT, scope recipes to a `userId`, add
login/register on the frontend. Biggest architectural change on the list."
This spec reads "per-user recipes" as *ownership*, not *visibility*: every
recipe belongs to exactly one account, but the shared library is browsable
by anyone — `GET /recipes`, `GET /recipes/{id}`, and the hero-image endpoint
never filter by caller and require no `Authorization` header at all. Only
mutation is exclusive: **editing, deleting, or attaching an image to a
recipe requires being its owner (and, before that, being signed in at
all).** (An earlier draft of this spec scoped reads to "my recipes" too;
that was revised after implementation showed it made the app's own seed data
— and, more generally, any account's recipes — invisible to every other
account, defeating the point of a library anyone signed in can browse. See
AUTHENTICATION_IMPLEMENTATION_NOTES.md. A later revision then dropped the
"signed in" requirement for reads entirely — a follow-up request to make the
list/detail views work for a logged-out visitor, not just any authenticated
one — documented in Part 3 and Part 6 below and in
AUTHENTICATION_IMPLEMENTATION_NOTES.md's "Follow-up" section.)
Auth is stateless: the backend issues a self-signed JWT on login/register,
the frontend stores it (`localStorage`, mirroring the plain-JSON persistence
this repo already uses for favorites/recently-viewed/theme prefs) and sends
it as a `Bearer` token on every request via a new `HttpInterceptorFn`. The
explicit tradeoff being accepted: a token in `localStorage` is readable by
any script that achieves XSS on the page (an httpOnly cookie would not be),
but it matches the plain bearer-token pattern implied by "JWT" in the
backlog wording, needs no CSRF handling, and requires no change to how the
existing `apiBaseUrlInterceptor` composes with a second interceptor. A
second tradeoff: a recipe you don't own returns `404` on a mutation attempt,
not `403` — same as any other nonexistent id today — so the API never
confirms that a given id belongs to *someone else's* account.

**Explicitly out of scope for this pass:** OAuth/social login, email
verification, forgot-password/reset flows, refresh-token rotation (the
issued JWT is a single access token with a fixed expiry; once it expires the
user re-logs-in — see "Deferred"), roles/permissions beyond "authenticated
user" (no admin, no RBAC), collaborative *editing* of a recipe across
accounts (reading is shared, but only the owner can ever mutate), rate-limiting
`/auth/**`, and migrating pre-existing recipe rows
in a populated database. That last one matters here specifically: this repo
has no migration tool (no Flyway/Liquibase, just
`spring.jpa.hibernate.ddl-auto=update`) and dev runs on an in-memory H2
database that starts empty on every restart, so a `NOT NULL` owner column
is a non-issue in dev. A real Postgres deployment with existing unowned
rows is out of scope for this spec to handle — see "Deferred."

---

## Current state (baseline)

- `Recipe` ([Recipe.java](../../recipe-manager-backend/src/main/java/com/example/recipemanager/model/Recipe.java), lines 18-87) has no `userId`/`owner`/`createdBy` field of any kind — recipes are global, shared, unowned. `@Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;` (lines 26-28).
- `RecipeController` ([RecipeController.java](../../recipe-manager-backend/src/main/java/com/example/recipemanager/controller/RecipeController.java)) has 8 endpoints (`listAll`, `getById`, `create`, `update`, `delete`, `uploadImage`, `deleteImage`, `getImage`) and **no security annotation anywhere in the file** — every one is fully open today.
- `RecipeService` ([RecipeService.java](../../recipe-manager-backend/src/main/java/com/example/recipemanager/service/RecipeService.java)) methods (`findAll`, `findById`, `create`, `update`, `delete`, `uploadImage`, `deleteImage`, `loadImage`) take no caller-identity parameter of any kind.
- `RecipeRepository` ([RecipeRepository.java](../../recipe-manager-backend/src/main/java/com/example/recipemanager/repository/RecipeRepository.java)) is `JpaRepository<Recipe, Long>, JpaSpecificationExecutor<Recipe>`, filtered via composable `Specification`s in `RecipeSpecifications` (`titleOrDescriptionContains`, `hasAnyTag`), AND-ed together in `RecipeService.findAll` via `Specification.allOf(...)`. `findAll` stays unfiltered by caller — ownership is enforced in the service layer only on the mutating methods, not via a repository-level spec.
- `RecipeRequest`/`RecipeResponse`/`RecipePageResponse` (`dto/`) have no user/owner field.
- `GlobalExceptionHandler` ([GlobalExceptionHandler.java](../../recipe-manager-backend/src/main/java/com/example/recipemanager/exception/GlobalExceptionHandler.java)) maps 5 exception types to RFC 7807 `ProblemDetail` (404 not-found, 400 invalid-sort-field/invalid-image/validation-failed, 400 image-too-large). **There is no 401/403 handler** — Spring Security's default entry point would otherwise return its own non-`ProblemDetail` body, inconsistent with every other error this API produces.
- [pom.xml](../../recipe-manager-backend/pom.xml): Spring Boot **4.1.0**, Java **25**. **No `spring-boot-starter-security`, no JWT library (`jjwt`/`nimbus-jose-jwt`), and no `spring-security-test`** anywhere in the tree — all net-new dependencies.
- [application.properties](../../recipe-manager-backend/src/main/resources/application.properties) — only file of its kind (no `-test`/`-dev` profile split). H2 in-memory (`DB_CLOSE_ON_EXIT=FALSE`), `ddl-auto=update`. No security-related property exists.
- No `SecurityConfig`, `SecurityFilterChain`, `User`/`Account` entity, or `UserRepository` exists anywhere in the codebase today — confirmed by a repo-wide search. The closest thing to CORS config is a `WebMvcConfigurer` bean in [AppConfig.java](../../recipe-manager-backend/src/main/java/com/example/recipemanager/AppConfig.java) (lines 42-54), allowing `:4200`/`:3000`. This is **not** a `CorsConfigurationSource` — Spring Security needs one explicitly wired via `http.cors(...)`, so this bean is replaced, not kept alongside the new config (see Part 3).
- [openapi.yaml](../../recipe-manager-backend/openapi.yaml) has no `security:` key and no `securitySchemes` — no auth documented today. `components.schemas` holds `RecipeRequest`/`RecipeResponse`/`RecipePageResponse`/`ProblemDetail`, hand-maintained as the Orval source of truth.
- Backend tests: `RecipeManagerApplicationTests` (`@SpringBootTest`, context load), `RecipeControllerTest` (`@WebMvcTest(RecipeController.class)`, `@MockitoBean RecipeService`), `RecipeRepositoryTest` (`@DataJpaTest`), `RecipeControllerImageTest` (`@SpringBootTest(webEnvironment = RANDOM_PORT)`). None reference any auth concept today — the moment `spring-boot-starter-security` lands on the classpath, `@WebMvcTest` auto-secures its slice and every existing `RecipeControllerTest` request starts failing with 401 *before* `SecurityConfig` is even written. This has to be accounted for in the same PR that adds the dependency (Part 3's "Files touched").
- Frontend routing ([app.routes.ts](../src/app/app.routes.ts)) is flat, no `canActivate`/`canMatch` on any route.
- [recipe.service.ts](../src/app/services/recipe.service.ts) wraps the generated `RecipesService` client; no auth/identity concept.
- Exactly one `HttpInterceptorFn` exists today, [api-base-url.interceptor.ts](../src/app/interceptors/api-base-url.interceptor.ts), prepending `environment.apiUrl` to relative request URLs, registered in [app.config.ts](../src/app/app.config.ts) via `provideHttpClient(withInterceptors([apiBaseUrlInterceptor]))`. No route guard, no token storage, no `jwt-decode`/`@auth0/angular-jwt` dependency exists anywhere in the repo.
- [orval.config.ts](../orval.config.ts) generates a tags-split client under `src/app/api/generated/` (one folder per OpenAPI tag, e.g. `recipes/`) plus `model/*.ts`; [recipe.model.ts](../src/app/models/recipe.model.ts) re-exports the generated types so app code never imports `api/generated/...` directly — any new `auth` tag in `openapi.yaml` produces an equivalent `api/generated/auth/` folder, re-exported through a new `models/auth.model.ts`.
- `localStorage` is already this app's convention for small pieces of client state, each behind a signal-based service: `favorites.service.ts`, `recently-viewed.service.ts`, `theme.service.ts`. A new `AuthService` follows the same idiom: `providedIn: 'root'`, plain `signal()`/`computed()` state, `.set()`/`.update()` inside `tap()` on the request `Observable` (the pattern `RecipeService`/`RecipeListComponent` already use, and the one [CODE_STYLE_SPEC.md](CODE_STYLE_SPEC.md) documents as binding: `inject()` over constructor DI, signals over `BehaviorSubject`, `takeUntilDestroyed()` on every subscription).
- [package.json](../package.json): Angular `^22.0.6`, no auth-related library present (no `jwt-decode`, no `@auth0/angular-jwt`, no `keycloak-angular`). None are needed — see Part 5.

---

## Part 1 — Backend: `User` account, password hashing, register/login DTOs

### Behavior

- An account is `username` + `password`, nothing else (no email — no verification/reset flow exists to make one useful yet). `username` is unique.
- `POST /auth/register` — body `{ username, password }`. `username` blank/taken → 400/409; `password` shorter than 8 chars → 400. On success: creates the account, **auto-logs-in** (returns a token immediately, same as login) rather than requiring a separate login call right after registering. 201.
- `POST /auth/login` — body `{ username, password }`. Wrong username or wrong password both produce the same 401 (never reveal which one was wrong). On success: 200 with the same response shape as register.
- Both endpoints return `{ token, userId, username }` — the frontend never needs to decode the JWT itself; the identity it needs is handed back in plain JSON alongside the token (see Part 5).

### Implementation

- New `model/User.java`: `@Entity @Table(name = "users")`, `id: Long` (`IDENTITY`, matching `Recipe`'s strategy), `username: String` (`@Column(nullable = false, unique = true)`), `password: String` (BCrypt hash, `@Column(nullable = false)`), `createdAt: Instant` (`@CreationTimestamp`). Lombok `@Data @Builder @NoArgsConstructor @AllArgsConstructor`, matching `Recipe`'s style.
- New `repository/UserRepository.java`: `JpaRepository<User, Long>` plus `Optional<User> findByUsername(String username)` and `boolean existsByUsername(String username)`.
- New `dto/RegisterRequest.java` / `dto/LoginRequest.java`: `username` (`@NotBlank`), `password` (`@NotBlank`, `@Size(min = 8)` on `RegisterRequest` only — login just needs "present," the strength check only matters when a password is being *set*).
- New `dto/AuthResponse.java`: `token: String`, `userId: Long`, `username: String`.
- New `exception/UsernameAlreadyExistsException.java` — mapped in `GlobalExceptionHandler` to 409, following the exact pattern of the existing 5 handlers (`ProblemDetail.forStatusAndDetail(CONFLICT, ...)`, type `.../errors/username-taken`).
- New `controller/AuthController.java`: `@RestController @RequestMapping("/auth")`, `@RequiredArgsConstructor`, depends on `UserRepository`, `PasswordEncoder`, and the `JwtService`/`AuthenticationManager` from Part 2. `register()` checks `existsByUsername`, saves with `passwordEncoder.encode(...)`, then generates a token exactly as `login()` does. `login()` builds a `UsernamePasswordAuthenticationToken` and calls `authenticationManager.authenticate(...)` (Spring Security throws `BadCredentialsException` on failure — handled in Part 3, not here).
- `PasswordEncoder` bean: `BCryptPasswordEncoder`, declared in the `SecurityConfig` from Part 3 (kept there, not here, since it's a security primitive other security beans depend on).

### Files touched

- New `model/User.java`, `repository/UserRepository.java`.
- New `dto/RegisterRequest.java`, `dto/LoginRequest.java`, `dto/AuthResponse.java`.
- New `exception/UsernameAlreadyExistsException.java`.
- [GlobalExceptionHandler.java](../../recipe-manager-backend/src/main/java/com/example/recipemanager/exception/GlobalExceptionHandler.java): add the 409 handler.
- New `controller/AuthController.java`.

---

## Part 2 — Backend: JWT issuance & stateless request authentication

### Behavior

- A JWT is issued on register/login, carries the user's id and username, and expires after a fixed window (default 24h, configurable).
- Every request other than `/auth/**` (and the existing Swagger/OpenAPI doc paths) must carry `Authorization: Bearer <token>`; a missing/expired/invalid token produces a 401 in the same `ProblemDetail` shape as every other error this API returns (wired in Part 3).

### Implementation

- New dependency: `io.jsonwebtoken:jjwt-api`/`jjwt-impl`/`jjwt-jackson` (0.12.x) — a self-issued, self-validated HMAC-signed JWT has no external issuer/JWK set, so the heavier `spring-boot-starter-oauth2-resource-server` (built for validating *externally issued* tokens against a JWK endpoint) is more machinery than this needs. `jjwt` plus a small custom filter is the standard shape for "one service issues and validates its own JWTs."
- New `security/JwtService.java`: `generateToken(User user): String` (subject = `username`, custom claim `userId`, `iat`/`exp` from `app.jwt.expiration-ms`, signed with an HMAC-SHA256 key built from `app.jwt.secret`), `extractUsername(String token): String`, `extractUserId(String token): Long`, `isTokenValid(String token): boolean` (signature + expiry check, swallowing `JwtException` into `false` rather than letting it propagate as a 500).
- New `application.properties` entries: `app.jwt.secret` (base64, ≥256-bit — a checked-in dev default is fine for this repo the same way the H2 URL is checked in, but flag in a comment that any real deployment must override it via an env var, since a leaked signing secret lets anyone mint valid tokens) and `app.jwt.expiration-ms=86400000` (24h).
- New `security/UserPrincipal.java` implementing `UserDetails`: wraps a `User`, `getAuthorities()` returns a single fixed `ROLE_USER` authority for everyone (no roles table — out of scope), `getUsername()`/`getPassword()` delegate to the wrapped `User`. Exposes `getId(): Long` (not part of `UserDetails`, used by the controller layer to thread ownership through — see Part 3).
- New `security/UserDetailsServiceImpl.java` implementing `UserDetailsService`: `loadUserByUsername` → `userRepository.findByUsername(...).map(UserPrincipal::new).orElseThrow(UsernameNotFoundException::new)`.
- New `security/JwtAuthenticationFilter.java` extends `OncePerRequestFilter`: reads `Authorization` header, strips `Bearer `, calls `JwtService.isTokenValid`, loads the `UserPrincipal` via `UserDetailsServiceImpl`, and sets `SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()))`. No token / invalid token → filter chain just continues unauthenticated (`SecurityConfig`'s `authorizeHttpRequests` in Part 3 is what turns "unauthenticated" into a 401 for protected paths, not this filter).

### Files touched

- [pom.xml](../../recipe-manager-backend/pom.xml): add `jjwt-api`/`jjwt-impl`/`jjwt-jackson`.
- [application.properties](../../recipe-manager-backend/src/main/resources/application.properties): `app.jwt.secret`, `app.jwt.expiration-ms`.
- New `security/JwtService.java`, `security/UserPrincipal.java`, `security/UserDetailsServiceImpl.java`, `security/JwtAuthenticationFilter.java`.
- New `security/JwtServiceTest.java` — unit test, no Spring context needed (generate → parse round-trip, expired token rejected, tampered signature rejected).

---

## Part 3 — Backend: `SecurityConfig` & recipe ownership

### Behavior

- `/auth/register`, `/auth/login`, the existing Swagger/OpenAPI paths, and the three read endpoints below are public; every other endpoint requires a valid token.
- `GET /recipes`, `GET /recipes/{id}`, and `GET /recipes/{id}/image` operate on **any** recipe regardless of who owns it and require **no `Authorization` header at all** — the shared library is browsable by a logged-out visitor, not just an authenticated one. (This was originally scoped to "any authenticated account," matching the backlog wording's "per-user recipes"; it was loosened further in a follow-up pass to drop the sign-in requirement for reads entirely, so the recipe list and detail pages work the same for anyone, logged in or not. See AUTHENTICATION_IMPLEMENTATION_NOTES.md's "Follow-up" section.)
- `PUT /recipes/{id}`, `DELETE /recipes/{id}`, `POST /recipes/{id}/image`, and `DELETE /recipes/{id}/image` only ever operate on recipes owned by the caller — another account's recipe id behaves exactly like a nonexistent id: 404, via the same `RecipeNotFoundException` already in use, not a new 403. `POST /recipes` silently sets the owner to the caller; there is no way to create a recipe on someone else's behalf.
- A request with no/invalid/expired token against a protected (mutating) endpoint gets a 401 `ProblemDetail`; an authenticated request that's syntactically fine but structurally forbidden (there's no such case today, since ownership failures collapse into 404) — the `AccessDeniedHandler` is wired for completeness/future-proofing but has no current trigger.
- CORS behavior is unchanged from today (`:4200`/`:3000` allowed) — just re-expressed as a `CorsConfigurationSource` instead of a `WebMvcConfigurer`.

### Implementation

- New `security/SecurityConfig.java`, `@Configuration @EnableWebSecurity @RequiredArgsConstructor`:
  - `SecurityFilterChain` bean: `csrf().disable()` (stateless bearer tokens, no cookies, nothing for CSRF to protect), `.cors(cors -> cors.configurationSource(corsConfigurationSource()))`, `.sessionManagement(... STATELESS)`, `.authorizeHttpRequests(auth -> auth.requestMatchers("/auth/**", "/v3/api-docs/**", "/swagger-ui/**").permitAll().requestMatchers(HttpMethod.GET, "/recipes", "/recipes/*", "/recipes/*/image").permitAll().anyRequest().authenticated())`, `.exceptionHandling(eh -> eh.authenticationEntryPoint(...).accessDeniedHandler(...))`, `.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)`.
  - `corsConfigurationSource(): CorsConfigurationSource` — a `UrlBasedCorsConfigurationSource` carrying forward exactly the origins/methods/headers/max-age from `AppConfig`'s current `corsConfigurer` bean.
  - `PasswordEncoder` bean (`BCryptPasswordEncoder`), `AuthenticationManager` bean (from `AuthenticationConfiguration`), `DaoAuthenticationProvider` wiring `UserDetailsServiceImpl` + the encoder.
  - Two small `@Component`s: `ProblemDetailAuthenticationEntryPoint implements AuthenticationEntryPoint` and `ProblemDetailAccessDeniedHandler implements AccessDeniedHandler`, each writing the same `ProblemDetail` JSON shape `GlobalExceptionHandler` uses elsewhere (401 type `.../errors/unauthorized`, 403 type `.../errors/forbidden`) directly to the response — `@RestControllerAdvice` can't intercept these since they fire from the filter chain, before a controller method (or the dispatcher) is ever reached.
- [AppConfig.java](../../recipe-manager-backend/src/main/java/com/example/recipemanager/AppConfig.java): **remove** the `corsConfigurer` `WebMvcConfigurer` bean (lines 42-54) — superseded by `SecurityConfig`'s `CorsConfigurationSource`; leaving both risks divergent CORS rules since Spring Security's filter chain runs before MVC's own CORS handling gets a chance to apply.
- `Recipe.java`: add `@ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "user_id", nullable = false) private User owner;`. Not exposed on `RecipeResponse` — the frontend never displays whose recipe it is.
- `RecipeService.java`: the mutating methods (`update`/`delete`/`uploadImage`/`deleteImage`) and `create` gain an `ownerId: Long` parameter, threaded straight through from the controller (no `SecurityContextHolder` reads inside the service layer — identity comes in as a plain parameter like every other input, keeping the service testable without a security context). `findAll`/`findById`/`loadImage` take no caller-identity parameter at all — they read across every account.
  - `findAll(...)`: unchanged from today — no owner-based spec is added; `q`/`tags` filtering is the only filtering that applies.
  - `update`/`delete`/`uploadImage`/`deleteImage`: load by id first, then compare `recipe.getOwner().getId().equals(ownerId)`; a mismatch throws the existing `RecipeNotFoundException` (same as a missing id) rather than a new forbidden-style exception, per the 404-not-403 decision above.
  - `findById`/`loadImage`: load by id with no ownership check at all — a missing id is still a 404, but an id owned by someone else resolves normally.
  - `create`: sets `owner` from `userRepository.getReferenceById(ownerId)` (a proxy reference, avoiding an extra `SELECT` just to attach the FK).
- `RecipeController.java`: `create`/`update`/`delete`/`uploadImage`/`deleteImage` gain a `@AuthenticationPrincipal UserPrincipal principal` parameter and pass `principal.getId()` through to the service call; `listAll`/`getById`/`getImage` call their service methods with no identity argument — these three are also `permitAll()` in `SecurityConfig` (see above), so they run with no principal at all when the caller has no token.
- Existing `RecipeControllerTest` (`@WebMvcTest`): now needs `spring-security-test`'s `.with(user(...))`/a custom `RequestPostProcessor` wrapping a `UserPrincipal`, since `@WebMvcTest` auto-secures once the security starter is present. `RecipeControllerImageTest` (`@SpringBootTest`, full stack): register/login for a real token first, attach it as the `Authorization` header on every request.

### Files touched

- New `security/SecurityConfig.java`, `security/ProblemDetailAuthenticationEntryPoint.java`, `security/ProblemDetailAccessDeniedHandler.java`.
- [AppConfig.java](../../recipe-manager-backend/src/main/java/com/example/recipemanager/AppConfig.java): remove the old CORS bean.
- [Recipe.java](../../recipe-manager-backend/src/main/java/com/example/recipemanager/model/Recipe.java): add `owner`.
- [RecipeService.java](../../recipe-manager-backend/src/main/java/com/example/recipemanager/service/RecipeService.java): thread `ownerId` through `create`/`update`/`delete`/`uploadImage`/`deleteImage`; ownership check on the four mutating id-based methods. `findAll`/`findById`/`loadImage` are unaffected.
- [RecipeController.java](../../recipe-manager-backend/src/main/java/com/example/recipemanager/controller/RecipeController.java): thread `@AuthenticationPrincipal UserPrincipal` through the five mutating endpoints only.
- [pom.xml](../../recipe-manager-backend/pom.xml): add `spring-boot-starter-security`, `spring-security-test` (test scope).
- [RecipeControllerTest.java](../../recipe-manager-backend/src/test/java/com/example/recipemanager/controller/RecipeControllerTest.java) / `RecipeControllerImageTest.java`: updated to authenticate every request (see Testing).
- New `SecurityConfigTest`/`AuthControllerTest`, new `RecipeOwnershipTest` (or extend `RecipeControllerImageTest`'s full-stack style) — see Testing.

---

## Part 4 — OpenAPI contract & client regeneration

### Behavior

- `openapi.yaml` gains a `bearerAuth` (`type: http, scheme: bearer, bearerFormat: JWT`) security scheme, applied globally via top-level `security:`, with `/auth/register`/`/auth/login` overriding it back to `security: []` (public).
- New paths `POST /auth/register`, `POST /auth/login`; new schemas `RegisterRequest`, `LoginRequest`, `AuthResponse`. `RecipeRequest`/`RecipeResponse`/`RecipePageResponse` are unchanged (owner is never serialized).
- New `401`/`403`/`409` response schemas reusing the existing `ProblemDetail` schema, added to the relevant operations.

### Implementation

- Edit `openapi.yaml` first, then `npm run api:generate` per the repo's cross-repo contract rule — regenerates a new `api/generated/auth/` folder (tags-split) with `authService.ts`-equivalent methods (`register`, `login`) and `model/registerRequest.ts`/`loginRequest.ts`/`authResponse.ts`.
- New `src/app/models/auth.model.ts`, mirroring `recipe.model.ts`'s re-export pattern: `export type { RegisterRequest, LoginRequest, AuthResponse } from '../api/generated/model';`.

### Files touched

- [openapi.yaml](../../recipe-manager-backend/openapi.yaml).
- `src/app/api/generated/**` (regenerated).
- New [auth.model.ts](../src/app/models/auth.model.ts).

---

## Part 5 — Frontend: `AuthService`, token storage, auth interceptor

### Behavior

- Logging in or registering stores `{ token, userId, username }` as one JSON blob in `localStorage` and updates in-memory signal state; a page reload rehydrates from `localStorage` so the session survives a refresh.
- Every outgoing API request (other than to `/auth/register`/`/auth/login` themselves) carries `Authorization: Bearer <token>` when a token is present.
- A `401` response from any request clears the stored session and redirects to `/login` — the simplest correct behavior for a fixed-expiry token with no refresh flow (Part 2's tradeoff).

### Implementation

- New `services/auth.service.ts`, `providedIn: 'root'`, following `RecipeService`'s exact idiom (`inject()`, signals, `tap()`-driven state updates, no `BehaviorSubject`):
  - `currentUser = signal<{ userId: number; username: string } | null>(this.readStoredUser())`, `token = signal<string | null>(this.readStoredToken())`, `isAuthenticated = computed(() => this.token() !== null)`.
  - `login(username, password): Observable<AuthResponse>` / `register(username, password): Observable<AuthResponse>` — call the generated `AuthService` client, `tap()` to persist to `localStorage` and update the signals on success.
  - `logout(): void` — clears `localStorage` and both signals, no server round-trip needed (no session to invalidate server-side with a stateless JWT).
  - Storage is one `localStorage` key (e.g. `auth`) holding the whole `{ token, userId, username }` object — plain JSON, exactly the pattern `favorites.service.ts`/`theme.service.ts` already use, not three separate keys.
- New `interceptors/auth.interceptor.ts` (`HttpInterceptorFn`, sibling to `api-base-url.interceptor.ts`): reads `AuthService.token()` via `inject()`, clones the request with the `Authorization` header when a token exists and the URL isn't `/auth/register`/`/auth/login`, and on the response pipe's `catchError`, a `401` triggers `authService.logout()` + `router.navigateByUrl('/login')` before re-throwing.
- [app.config.ts](../src/app/app.config.ts): add `authInterceptor` to `withInterceptors([apiBaseUrlInterceptor, authInterceptor])` — after the base-URL interceptor, since token-attachment doesn't care about `req.url`'s shape but reads more naturally as "resolve the URL, then attach identity."
- No new npm dependency: the frontend never decodes the JWT itself (it already has `userId`/`username` from the login/register response body), so no `jwt-decode`/`@auth0/angular-jwt` is needed.

### Files touched

- New `services/auth.service.ts`, `auth.service.spec.ts`.
- New `interceptors/auth.interceptor.ts`, `auth.interceptor.spec.ts`.
- [app.config.ts](../src/app/app.config.ts): register the new interceptor.

---

## Part 6 — Frontend: login/register UI, route guard, nav bar

### Behavior

- `/login` and `/register` are new public routes. Originally, every recipe route (`recipes`, `recipes/new`, `recipes/:id`, `recipes/:id/edit`) required authentication — an unauthenticated visit redirected to `/login?returnUrl=<original>`, and a successful login sent the user back to `returnUrl` (default `/recipes`). Per the Part 3 follow-up making reads public server-side, `recipes` (list) and `recipes/:id` (detail) are no longer guarded — anyone can view them, logged in or not. `recipes/new` and `recipes/:id/edit` stay behind `authGuard`, since creating/editing still requires an account.
- Mutation-adjacent controls are hidden from a logged-out visitor rather than shown-then-401ing: `RecipeListComponent`'s "New Recipe" empty-state CTA and each card's Edit/Delete buttons, and `RecipeDetailComponent`'s Edit/Clone/Delete buttons, are all wrapped in `@if (auth.isAuthenticated())`. The Favorite/Print/scale controls stay visible either way — they're local-only or read-only, no ownership or account involved.
- `NavBarComponent` shows the logged-in `username` plus a "Log out" action when authenticated, and "Log in"/"Register" links when not; its "New Recipe" link is likewise only rendered when authenticated.

### Implementation

- New `authGuard` (`CanActivateFn`, `guards/auth.guard.ts`): checks `AuthService.isAuthenticated()`; if false, `router.navigate(['/login'], { queryParams: { returnUrl: state.url } })` and returns `false`. Applied only to `recipes/new` and `recipes/:id/edit` — `recipes` and `recipes/:id` carry no `canActivate` at all.
- [app.routes.ts](../src/app/app.routes.ts): add `{ path: 'login', loadComponent: ... }`, `{ path: 'register', loadComponent: ... }`; add `canActivate: [authGuard]` to the two mutation-only recipe routes.
- New `components/login/login.component.ts` / `components/register/register.component.ts`: typed reactive forms (`FormGroup<{ username: FormControl<string>; password: FormControl<string> }>`), per [CODE_STYLE_SPEC.md](CODE_STYLE_SPEC.md)'s existing convention for `RecipeFormComponent`. On submit, call `AuthService.login()`/`register()`, `.subscribe()` to navigate to `returnUrl` (from the route's query params) or `/recipes` on success, surface the `ProblemDetail`'s `detail` string on failure (401 for bad login, 409 for taken username) the same way `RecipeFormComponent` surfaces validation errors today.
- [nav-bar.component.ts](../src/app/components/nav-bar/nav-bar.component.ts): inject `AuthService`, conditionally render username + logout vs. login/register links, and the "New Recipe" link; logout calls `authService.logout()` then navigates to `/login`.
- [recipe-list.component.ts](../src/app/components/recipe-list/recipe-list.component.ts) / [recipe-detail.component.ts](../src/app/components/recipe-detail/recipe-detail.component.ts): both inject `AuthService` and expose it as `protected readonly auth`, used purely in the template to gate mutation controls — no behavioral change to the components' own logic, since the backend is still the actual enforcement point (a stale/tampered client state showing a button it shouldn't just gets a 401 on submit, same as any other client/server drift).

### Files touched

- New `guards/auth.guard.ts`, `auth.guard.spec.ts`.
- [app.routes.ts](../src/app/app.routes.ts): new routes, guard on the two mutation-only recipe routes.
- New `components/login/login.component.ts` (+ `.html`, `.spec.ts`), `components/register/register.component.ts` (+ `.html`, `.spec.ts`).
- [nav-bar.component.ts](../src/app/components/nav-bar/nav-bar.component.ts) / `.html` / `.spec.ts`.
- [recipe-list.component.ts](../src/app/components/recipe-list/recipe-list.component.ts) / `.html` / `.spec.ts`, [recipe-detail.component.ts](../src/app/components/recipe-detail/recipe-detail.component.ts) / `.html`: gate mutation controls on `auth.isAuthenticated()`.

---

## Testing

- **Backend**:
  - `JwtServiceTest` (unit, no Spring context): generate → parse round-trip recovers `username`/`userId`; expired token and tampered-signature token both fail validation.
  - `AuthControllerTest` (`@WebMvcTest`): register with a taken username → 409; register with a short password → 400; login with wrong password/nonexistent username → 401 (same response either way); successful register/login → 200/201 with `token`/`userId`/`username` present.
  - `RecipeControllerTest` (updated): every existing case now runs with an authenticated `UserPrincipal` attached via `spring-security-test`; `listAllWithNoTokenSucceeds`/`getByIdWithNoTokenSucceeds` cover the public-read behavior (post follow-up — see below).
  - New full-stack ownership test (`@SpringBootTest`, extending `RecipeControllerImageTest`'s style): register user A and user B; A creates a recipe; B's `GET /recipes/{id}` and `GET /recipes/{id}/image` against A's recipe succeed (read is shared), while B's `PUT`/`DELETE`/upload-image/delete-image against the same id all 404; A's own requests against the same id succeed; `GET /recipes` (list) for B includes A's recipe alongside B's own. Extended (post follow-up) with an anonymous-caller variant of the same three reads plus 401 checks on `POST`/`PUT`/`DELETE` with no token at all.
- **Frontend**:
  - `AuthService`: `login()`/`register()` persist to `localStorage` and update `currentUser`/`token`/`isAuthenticated` on success; `logout()` clears both; rehydration on construction reads a pre-existing `localStorage` value correctly.
  - `authInterceptor`: attaches `Authorization` when a token is present, omits it for `/auth/register`/`/auth/login`, and on a `401` response calls `logout()` + navigates to `/login`.
  - `authGuard`: allows navigation when authenticated; redirects to `/login` with the right `returnUrl` query param when not.
  - `LoginComponent`/`RegisterComponent`: valid submit navigates to `returnUrl`/`/recipes`; a 401/409 `ProblemDetail` from the server renders the `detail` message and does not navigate.
  - `NavBarComponent`: renders username + logout when `isAuthenticated()` is true, login/register links otherwise.
  - `RecipeListComponent` (post follow-up): Edit/Delete/New-Recipe controls are absent from the DOM (not just disabled) for an unauthenticated caller, while the favorite button remains.
  - E2e (`@playwright/test`, per [E2E_TESTING_SPEC.md](E2E_TESTING_SPEC.md)): the shared `page`/`api` fixture (`e2e/fixtures/api.ts`) registers-and-logs-in by default, which every CRUD/validation spec still relies on. A dedicated `recipe-anonymous-access.spec.ts` (post follow-up) opens its own unauthenticated `browser.newContext()` to verify list/detail load and mutation controls stay hidden for a logged-out visitor, using the fixture's authenticated `api` only to seed/clean up data server-side.

---

## Suggested sequencing

1. **Part 1** (User entity, register/login DTOs, `AuthController`) — lands without touching `RecipeController`/`SecurityConfig` at all; testable in isolation once Part 2's `JwtService` exists to issue a token.
2. **Part 2** (JWT issuance, `JwtAuthenticationFilter`, `UserPrincipal`) — together with Part 1 in the same PR in practice, since `AuthController` needs `JwtService` to return a token; separated here only to describe them as distinct concerns.
3. **Part 3** (`SecurityConfig`, CORS migration, recipe ownership) — the big one: this is what actually locks the API down and is where `RecipeControllerTest` breaks and needs fixing in the same commit. Land Parts 1-3 together; there's no useful intermediate state where auth exists but nothing is enforced yet.
4. **Part 4** (OpenAPI + client regen) — immediately after, before touching frontend code, same as every other spec in this repo.
5. **Part 5** (`AuthService`, interceptor) — frontend can now authenticate and attach tokens, but there's nowhere to log in yet.
6. **Part 6** (login/register UI, guard, nav bar) — last; this is what actually locks the frontend routes and gives a user somewhere to type credentials.

## Deferred

- Refresh tokens / silent re-authentication — today a user is simply logged out (redirected to `/login`) the moment their fixed-expiry token lapses. A refresh-token flow (short-lived access token + long-lived refresh token, rotated on use) is a well-scoped follow-up once the basic flow is proven out.
- Data migration for an already-populated, non-H2 deployment: assigning ownership to pre-existing recipe rows (e.g. a "migrate everything to a designated admin account" script) if this app is ever actually deployed against Postgres with real data before this spec lands. Not needed for this repo's current all-H2, no-migration-tool reality.
- Collaborative *editing* — reads are already shared across every account (see Part 3), but letting more than one account edit the same recipe would need a join table (multiple owners/editors per recipe) and is a meaningfully different feature.
- Roles/admin capabilities beyond "authenticated user."
- Account settings (change password, change username, delete account).
