import { APIRequestContext, test as base, request } from '@playwright/test';

/**
 * The backend has no dedicated test profile (see E2E_TESTING_SPEC.md) — the
 * H2 in-memory DB persists for the life of the `mvn spring-boot:run` process,
 * across every test in a run. Every recipe created here must use a unique
 * title and be cleaned up by the test that created it.
 */
export const API_BASE_URL = 'http://localhost:8080';

export interface RecipeRequestBody {
  title: string;
  description?: string | null;
  content: string;
}

export interface RecipeResponseBody extends RecipeRequestBody {
  id: number;
  createdAt: string;
  updatedAt: string;
}

/** Unique, recognizable title so E2E-created rows never collide with each other or hand-created dev data. */
export function uniqueTitle(label = 'Recipe'): string {
  return `E2E Test ${label} ${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

export async function seedRecipe(
  api: APIRequestContext,
  overrides: Partial<RecipeRequestBody> = {},
): Promise<RecipeResponseBody> {
  const body: RecipeRequestBody = {
    title: uniqueTitle('Seed'),
    description: 'Seeded via e2e/fixtures/api.ts',
    content: '## Ingredients\n- test ingredient\n\n## Steps\n1. Do the test step.',
    ...overrides,
  };
  const response = await api.post('/recipes', { data: body });
  if (!response.ok()) {
    throw new Error(`Failed to seed recipe: ${response.status()} ${await response.text()}`);
  }
  return response.json();
}

/** Best-effort delete — swallows 404 so cleanup is safe even if a test already deleted the row via the UI. */
export async function deleteRecipeIfExists(api: APIRequestContext, id: number): Promise<void> {
  const response = await api.delete(`/recipes/${id}`);
  if (!response.ok() && response.status() !== 404) {
    throw new Error(`Failed to delete recipe ${id}: ${response.status()} ${await response.text()}`);
  }
}

interface AuthedUser {
  token: string;
  userId: number;
  username: string;
}

/** Unique per-test credentials — mirrors uniqueTitle()'s collision-avoidance for a parallel test run. */
function uniqueCredentials(): { username: string; password: string } {
  return {
    username: `e2e_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`,
    password: 'e2e-test-password-1',
  };
}

export const test = base.extend<{ api: APIRequestContext; authedUser: AuthedUser }>({
  // Every route under /recipes now requires a bearer token (AUTHENTICATION_SPEC.md
  // Part 3), and the frontend's /recipes routes are guarded client-side too
  // (Part 6). Registering a fresh account per test gives both the `api`
  // fixture (raw HTTP calls) and the `page` fixture (browser navigation,
  // overridden below) a valid session with no cross-test collisions.
  authedUser: async ({}, use) => {
    const req = await request.newContext({ baseURL: API_BASE_URL });
    const { username, password } = uniqueCredentials();
    const response = await req.post('/auth/register', { data: { username, password } });
    if (!response.ok()) {
      throw new Error(
        `Failed to register e2e test user: ${response.status()} ${await response.text()}`,
      );
    }
    const body: AuthedUser = await response.json();
    await req.dispose();
    await use(body);
  },

  api: async ({ authedUser }, use) => {
    const api = await request.newContext({
      baseURL: API_BASE_URL,
      extraHTTPHeaders: { Authorization: `Bearer ${authedUser.token}` },
    });
    await use(api);
    await api.dispose();
  },

  // Seeds localStorage with the registered session before any app script
  // runs, so AuthService rehydrates as already-authenticated on first paint
  // and authGuard never bounces the test to /login.
  page: async ({ page, authedUser }, use) => {
    await page.addInitScript((auth) => {
      window.localStorage.setItem('auth', JSON.stringify(auth));
    }, authedUser);
    await use(page);
  },
});

export { expect } from '@playwright/test';
