import { deleteRecipeIfExists, expect, seedRecipe, test, uniqueTitle } from '../fixtures/api';
import { ConfirmDialogPage } from '../pages/confirm-dialog.page';
import { RecipeListPage } from '../pages/recipe-list.page';

test('a seeded recipe appears in the list', async ({ page, api }) => {
  const recipe = await seedRecipe(api, { title: uniqueTitle('List Loaded') });
  const list = new RecipeListPage(page);

  await list.goto();
  await expect(list.titleLink(recipe.title)).toBeVisible();

  await deleteRecipeIfExists(api, recipe.id);
});

// Forcing a genuine network failure against a real, running backend is
// brittle/flaky by nature (would require killing the backend mid-suite).
// Load-failure messaging is covered by Vitest component tests instead —
// see UNIT_TESTING_SPEC.md.
test.skip('shows an error message when the backend is unreachable', async () => {});

test('delete from the list: cancel leaves the row, confirm removes it', async ({ page, api }) => {
  const recipe = await seedRecipe(api, { title: uniqueTitle('List Delete') });
  const list = new RecipeListPage(page);
  const dialog = new ConfirmDialogPage(page);

  await list.goto();
  await expect(list.card(recipe.title)).toBeVisible();

  await list.deleteRecipe(recipe.title);
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await dialog.cancel();
  await expect(list.card(recipe.title)).toBeVisible();

  await list.deleteRecipe(recipe.title);
  await dialog.confirm();
  await expect(list.card(recipe.title)).toHaveCount(0);
});
