# Recipe Manager — Frontend

Angular 17 single-page application for the Recipe Manager. Provides a recipe list view, a Markdown-rendered detail view, and a create/edit form. Communicates with the [recipe-manager-backend](https://github.com/patrick473/recipe-manager-backend) REST API.

---

## Table of contents

- [Quick start](#quick-start)
- [Project structure](#project-structure)
- [Views and routing](#views-and-routing)
- [Recipe service API](#recipe-service-api)
- [Form validation](#form-validation)
- [Markdown rendering](#markdown-rendering)
- [Configuration](#configuration)
- [Running tests](#running-tests)
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

```
src/
  app/
    models/
      recipe.model.ts          # TypeScript interfaces for Recipe and RecipeRequest
    services/
      recipe.service.ts        # HttpClient wrapper for the REST API
    components/
      recipe-list/             # Card grid of all recipes with delete actions
      recipe-detail/           # Single recipe with Markdown preview
      recipe-form/             # Create / edit form (shared component)
    app.routes.ts              # Route definitions
    app.config.ts              # Application-level providers
    app.component.ts           # Root shell with header navigation
  environments/
    environment.ts             # Dev: apiUrl = http://localhost:8080
    environment.prod.ts        # Prod: apiUrl = https://api.recipe-manager.example.com
  styles.scss                  # Global design system tokens and component styles
```

---

## Views and routing

| URL | Component | Description |
|-----|-----------|-------------|
| `/` | redirect | Redirects to `/recipes` |
| `/recipes` | RecipeListComponent | Card grid of all recipes |
| `/recipes/new` | RecipeFormComponent | Blank create form |
| `/recipes/:id` | RecipeDetailComponent | Recipe with Markdown preview |
| `/recipes/:id/edit` | RecipeFormComponent | Pre-filled edit form |

---

## Recipe service API

`RecipeService` (`src/app/services/recipe.service.ts`) wraps the backend REST API.

| Method | Signature | Maps to |
|--------|-----------|---------|
| `getAll()` | `(): Observable<Recipe[]>` | `GET /recipes` |
| `getById(id)` | `(id: number): Observable<Recipe>` | `GET /recipes/{id}` |
| `create(request)` | `(r: RecipeRequest): Observable<Recipe>` | `POST /recipes` |
| `update(id, request)` | `(id, r: RecipeRequest): Observable<Recipe>` | `PUT /recipes/{id}` |
| `delete(id)` | `(id: number): Observable<void>` | `DELETE /recipes/{id}` |

Inject the service with standard Angular DI:

```typescript
constructor(private recipeService: RecipeService) {}

this.recipeService.getAll().subscribe(recipes => { ... });
```

### TypeScript interfaces

```typescript
// src/app/models/recipe.model.ts

export interface Recipe {
  id: number;
  title: string;
  description: string | null;
  content: string;       // Markdown body
  createdAt: string;     // ISO-8601 UTC
  updatedAt: string;     // ISO-8601 UTC
}

export interface RecipeRequest {
  title: string;
  description?: string | null;
  content: string;
}
```

---

## Form validation

`RecipeFormComponent` uses Angular Reactive Forms with the following rules:

| Field | Rule | Error message |
|-------|------|---------------|
| `title` | Required | "Title is required." |
| `title` | Max 255 chars | "Title must not exceed 255 characters." |
| `content` | Required | "Content is required." |

Validation errors appear below the field only after the user has touched it or attempted to submit. Submitting an invalid form marks all controls as touched and aborts the HTTP call.

Backend validation errors (HTTP 400) returned as RFC 7807 Problem Details are also surfaced in a banner above the form.

---

## Markdown rendering

`RecipeDetailComponent` uses the [`marked`](https://github.com/markedjs/marked) library to convert the stored Markdown string to HTML, then passes it through Angular's `DomSanitizer.bypassSecurityTrustHtml` before binding with `[innerHTML]`. The global `.markdown-body` CSS class in `styles.scss` styles the output.

Supported elements: headings (h1–h6), paragraphs, bold, italic, unordered and ordered lists, blockquotes, inline code, fenced code blocks, horizontal rules, and links.

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

## Running tests

```bash
npm test
```

Tests run in headless Chrome via Karma and Jasmine.

---

## Building for production

```bash
npm run build:prod
```

Output is written to `dist/recipe-manager-frontend/`. Serve the contents of that directory from any static web server or CDN.
