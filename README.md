# Recipe Manager — Frontend

Angular 22 single-page application for the Recipe Manager. Provides a recipe list view, a Markdown-rendered detail view, and a create/edit form, with light/dark theming. Communicates with the [recipe-manager-backend](https://github.com/patrick473/recipe-manager-backend) REST API through a fully generated (Orval) API client. Uses signals throughout — no NgModules, no `@Input()` decorators, no constructor injection.

---

## Table of contents

- [Quick start](#quick-start)
- [Project structure](#project-structure)
- [Views and routing](#views-and-routing)
- [Generated API client](#generated-api-client)
- [Recipe service](#recipe-service)
- [Form validation](#form-validation)
- [Markdown rendering](#markdown-rendering)
- [Theming](#theming)
- [Configuration](#configuration)
- [Linting and formatting](#linting-and-formatting)
- [Running tests](#running-tests)
- [End-to-end tests](#end-to-end-tests)
- [Building for production](#building-for-production)

---

## Quick start

Requirements: Node.js 18+, npm 9+.

```bash
# Clone and install
git clone https://github.com/patrick473/recipe-manager-frontend.git
cd recipe-manager-frontend
npm install

# Start the Angular dev server (requires the backend on http://localhost:8080)
npm start

# Navigate to:
#   http://localhost:4200
```

The dev server proxies nothing by default — CORS is handled on the backend.

---

## Project structure

```text
src/
  app/
    api/
      generated/
        recipes/
          recipes.service.ts   # Orval-generated Angular HttpClient API methods
        model/                 # Orval-generated request/response interfaces
    models/
      recipe.model.ts          # Re-exports the generated Recipe/RecipeRequest types
    services/
      recipe.service.ts        # Signal-based wrapper around the generated API client
      theme.service.ts         # Light/dark theme state, persisted to localStorage
    interceptors/
      api-base-url.interceptor.ts   # Prepends environment.apiUrl to relative requests
    components/
      nav-bar/                 # Header navigation with theme toggle
      recipe-list/             # Card grid of all recipes with delete actions
      recipe-detail/           # Single recipe with Markdown preview
      recipe-form/             # Create / edit form (shared component)
    shared/
      button.directive.ts      # Shared button styling directive
      confirm-dialog/          # Confirm dialog component + service
      icon/                    # Icon component
      loader/                  # Loading spinner component
    app.routes.ts               # Route definitions
    app.config.ts                # Application-level providers (router, HttpClient, interceptor)
    app.component.ts             # Root shell with nav bar and router outlet
  environments/
    environment.ts             # Dev: apiUrl = http://localhost:8080
    environment.prod.ts        # Prod: apiUrl = https://api.recipe-manager.example.com
  styles.scss                  # Global design system tokens and component styles
e2e/                            # Playwright end-to-end tests (page objects + specs)
orval.config.ts                 # Orval codegen config, points at ../recipe-manager-backend/openapi.yaml
```

---

## Views and routing

| URL                 | Component             | Description                  |
| ------------------- | --------------------- | ---------------------------- |
| `/`                 | redirect              | Redirects to `/recipes`      |
| `/recipes`          | RecipeListComponent   | Card grid of all recipes     |
| `/recipes/new`      | RecipeFormComponent   | Blank create form            |
| `/recipes/:id`      | RecipeDetailComponent | Recipe with Markdown preview |
| `/recipes/:id/edit` | RecipeFormComponent   | Pre-filled edit form         |

---

## Generated API client

The frontend does not hand-write HTTP calls or DTOs. [Orval](https://orval.dev/) reads the backend's hand-authored `../recipe-manager-backend/openapi.yaml` (config in `orval.config.ts`) and generates:

- `src/app/api/generated/recipes/recipes.service.ts` — Angular `HttpClient`-based methods (`listRecipes`, `getRecipe`, `createRecipe`, `updateRecipe`, `deleteRecipe`)
- `src/app/api/generated/model/*` — request/response interfaces (`RecipeRequest`, `RecipeResponse`, `ProblemDetail`, ...)

`src/app/models/recipe.model.ts` re-exports these as `Recipe`/`RecipeRequest` rather than declaring its own shapes.

**Whenever the backend's `openapi.yaml` or DTOs change, regenerate before touching consuming code:**

```bash
npm run api:generate
```

The generated files are checked in but must be kept in sync manually — codegen does not run automatically on build.

Because the generated client emits relative URLs (e.g. `/recipes`), `src/app/interceptors/api-base-url.interceptor.ts` prepends `environment.apiUrl` to every relative request at the `HttpClient` interceptor level — this is the only place the environment-specific backend host is applied.

---

## Recipe service

`RecipeService` (`src/app/services/recipe.service.ts`) wraps the generated `RecipesService` and layers Angular signals on top for reactive UI state.

| Method                      | Signature                                                    | Maps to                                                          |
| --------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------- |
| `getAll()`                  | `(): Observable<Recipe[]>`                                   | `GET /recipes`                                                   |
| `getById(id)`               | `(id: number): Observable<Recipe>`                           | `GET /recipes/{id}`                                              |
| `create(request)`           | `(r: RecipeRequest): Observable<Recipe>`                     | `POST /recipes`                                                  |
| `update(id, request)`       | `(id, r: RecipeRequest): Observable<Recipe>`                 | `PUT /recipes/{id}`                                              |
| `delete(id)`                | `(id: number): Observable<void>`                             | `DELETE /recipes/{id}`                                           |
| `deleteWithConfirm(recipe)` | `(r: Recipe, onConfirmed?: () => void): Observable<boolean>` | shows a confirm dialog, then `DELETE /recipes/{id}` if confirmed |

It also exposes reactive state consumed by components:

| Signal        | Type                         | Description                                        |
| ------------- | ---------------------------- | -------------------------------------------------- |
| `loading`     | `Signal<boolean>`            | True while a `getAll()` request is in flight       |
| `recipeCount` | `Signal<number>`             | Updated after `getAll()` / `create()` / `delete()` |
| `hasRecipes`  | `Signal<boolean>` (computed) | `recipeCount() > 0`                                |

Inject the service with field-based `inject()` — the codebase uses `inject()` everywhere and never uses constructor injection:

```typescript
export class RecipeListComponent {
  private readonly recipeService = inject(RecipeService);

  ngOnInit(): void {
    this.recipeService.getAll().subscribe((recipes) => { ... });
  }
}
```

### TypeScript types

```typescript
// src/app/models/recipe.model.ts — re-exported from src/app/api/generated/model

export type Recipe = RecipeResponse; // id, title, description, content, createdAt, updatedAt
export type RecipeRequest = { title: string; description?: string | null; content: string };
```

---

## Form validation

`RecipeFormComponent` uses Angular Reactive Forms with the following rules:

| Field     | Rule          | Error message                           |
| --------- | ------------- | --------------------------------------- |
| `title`   | Required      | "Title is required."                    |
| `title`   | Max 255 chars | "Title must not exceed 255 characters." |
| `content` | Required      | "Content is required."                  |

Validation errors appear below the field only after the user has touched it or attempted to submit. Submitting an invalid form marks all controls as touched and aborts the HTTP call.

Backend validation errors (HTTP 400) returned as RFC 7807 Problem Details are also surfaced in a banner above the form.

---

## Markdown rendering

`RecipeDetailComponent` uses the [`marked`](https://github.com/markedjs/marked) library to convert the stored Markdown string to HTML, then passes it through Angular's `DomSanitizer.bypassSecurityTrustHtml` before binding with `[innerHTML]`. The global `.markdown-body` CSS class in `styles.scss` styles the output.

Supported elements: headings (h1–h6), paragraphs, bold, italic, unordered and ordered lists, blockquotes, inline code, fenced code blocks, horizontal rules, and links.

---

## Theming

`ThemeService` (`src/app/services/theme.service.ts`) tracks a `darkMode` signal, seeded from `localStorage` (`theme` key) and falling back to the OS `prefers-color-scheme` media query. Toggling (via the nav bar's theme button in `NavBarComponent`) persists the choice and sets `data-theme="dark"`/`data-theme="light"` on `<html>`, which drives the CSS custom properties in `styles.scss`.

---

## Configuration

The API base URL is read from the environment file at build time.

`src/environments/environment.ts` (development):

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080',
};
```

`src/environments/environment.prod.ts` (production build):

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://api.recipe-manager.example.com',
};
```

To point the app at a different backend, update `apiUrl` in the relevant environment file before building.

---

## Linting and formatting

ESLint (`eslint.config.js`, via `@angular-eslint/schematics`) and Prettier (`.prettierrc.json`) are configured. Run both before sending changes for review:

```bash
npm run lint
npm run format        # rewrites files
npm run format:check  # CI-style check, no writes
```

---

## Running tests

Unit tests run via Angular's experimental Vitest-based builder (`@angular/build:unit-test`), not Karma/Jasmine:

```bash
npm test
```

To run a single test file, use `ng test` with `--include` (running Vitest directly via `npx vitest run <path>` fails — the Angular builder sets up the JIT compiler that Vitest needs):

```bash
npx ng test --include=src/app/services/recipe.service.spec.ts --watch=false
```

---

## End-to-end tests

Playwright specs live in `e2e/` (page objects in `e2e/pages/`, fixtures in `e2e/fixtures/`, specs in `e2e/tests/`), configured via `playwright.config.ts`:

```bash
npm run e2e         # run headless
npm run e2e:ui      # run with the Playwright UI runner
npm run e2e:report  # open the last HTML report
```

The `e2e` job in `.github/workflows/ci.yml` is currently disabled (`if: false`); it is not part of the default CI run.

---

## Building for production

```bash
npm run build:prod
```

Output is written to `dist/recipe-manager-frontend/`. Serve the contents of that directory from any static web server or CDN.
