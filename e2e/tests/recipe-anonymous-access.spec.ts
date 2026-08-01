import { deleteRecipeIfExists, expect, seedRecipe, test, uniqueTitle } from '../fixtures/api';
import { RecipeDetailPage } from '../pages/recipe-detail.page';
import { RecipeListPage } from '../pages/recipe-list.page';

/**
 * The `test`/`page` fixtures from `../fixtures/api` seed an authenticated
 * session before every test (see AUTHENTICATION_SPEC.md). These specs need
 * the opposite — a genuinely logged-out visitor — so they open a fresh
 * browser context via the `browser` fixture instead of using the
 * pre-authenticated `page`, while still using the authenticated `api`
 * fixture to seed and clean up fixture data server-side.
 */
test('an unauthenticated visitor can browse the list and detail, but sees no mutation controls', async ({
  browser,
  api,
}) => {
  const recipe = await seedRecipe(api, { title: uniqueTitle('Anonymous Access') });
  const context = await browser.newContext();
  const page = await context.newPage();
  const list = new RecipeListPage(page);
  const detail = new RecipeDetailPage(page);

  try {
    await list.goto();
    await expect(list.titleLink(recipe.title)).toBeVisible();
    await expect(list.newRecipeLink).toHaveCount(0);
    await expect(list.editLink(recipe.title)).toHaveCount(0);
    await expect(list.deleteButton(recipe.title)).toHaveCount(0);

    await list.titleLink(recipe.title).click();
    await expect(detail.heading(recipe.title)).toBeVisible();
    await expect(detail.editLink).toHaveCount(0);
    await expect(detail.deleteButton).toHaveCount(0);
  } finally {
    await context.close();
    await deleteRecipeIfExists(api, recipe.id);
  }
});

test('an unauthenticated visit to a recipe URL directly (no prior navigation) still loads it', async ({
  browser,
  api,
}) => {
  const recipe = await seedRecipe(api, { title: uniqueTitle('Anonymous Direct') });
  const context = await browser.newContext();
  const page = await context.newPage();
  const detail = new RecipeDetailPage(page);

  try {
    await detail.goto(recipe.id);
    await expect(detail.heading(recipe.title)).toBeVisible();
  } finally {
    await context.close();
    await deleteRecipeIfExists(api, recipe.id);
  }
});
