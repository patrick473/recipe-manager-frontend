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

export const test = base.extend<{ api: APIRequestContext }>({
  api: async ({}, use) => {
    const api = await request.newContext({ baseURL: API_BASE_URL });
    await use(api);
    await api.dispose();
  },
});

export { expect } from '@playwright/test';
