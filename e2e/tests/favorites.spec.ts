import { deleteRecipeIfExists, expect, seedRecipe, test, uniqueTitle } from '../fixtures/api';
import { ConfirmDialogPage } from '../pages/confirm-dialog.page';
import { RecipeListPage } from '../pages/recipe-list.page';

// Favorites are stored in the browser's localStorage (FavoritesService), not
// on the backend, and Playwright gives each test its own isolated browser
// context — so favorite state never leaks between tests even though the
// backend's recipe rows are shared. Each test still seeds/deletes its own
// recipe via the api fixture to keep the shared DB clean.

test('toggling a recipe favorite shows/hides it in the Favorites strip', async ({ page, api }) => {
  const recipe = await seedRecipe(api, { title: uniqueTitle('Favorite Toggle') });
  const list = new RecipeListPage(page);

  try {
    await list.goto();
    await expect(list.card(recipe.title)).toBeVisible();
    await expect(list.favoritesStrip).toHaveCount(0);

    // toggle on from the main grid card
    const toggle = list.favoriteToggle(recipe.title);
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();

    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(list.favoritesStrip).toBeVisible();
    await expect(list.favoritesStripCard(recipe.title)).toBeVisible();

    // toggle off from the main grid card removes it from the strip
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(list.favoritesStripCard(recipe.title)).toHaveCount(0);
    // no other favorites remain, so the whole strip disappears again
    await expect(list.favoritesStrip).toHaveCount(0);
  } finally {
    await deleteRecipeIfExists(api, recipe.id);
  }
});

test('favorite state persists across a page reload', async ({ page, api }) => {
  const recipe = await seedRecipe(api, { title: uniqueTitle('Favorite Persist') });
  const list = new RecipeListPage(page);

  try {
    await list.goto();
    const toggle = list.favoriteToggle(recipe.title);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    await page.reload();

    await expect(list.card(recipe.title)).toBeVisible();
    await expect(list.favoriteToggle(recipe.title)).toHaveAttribute('aria-pressed', 'true');
    await expect(list.favoritesStripCard(recipe.title)).toBeVisible();

    // clean up favorite state before deleting, matching the toggle-then-untoggle convention
    await list.favoriteToggle(recipe.title).click();
    await expect(list.favoriteToggle(recipe.title)).toHaveAttribute('aria-pressed', 'false');
  } finally {
    await deleteRecipeIfExists(api, recipe.id);
  }
});

test('deleting a favorited recipe removes it from the Favorites strip (regression: no ghost favorites)', async ({
  page,
  api,
}) => {
  const recipe = await seedRecipe(api, { title: uniqueTitle('Favorite Delete') });
  const list = new RecipeListPage(page);
  const dialog = new ConfirmDialogPage(page);

  try {
    await list.goto();
    await list.favoriteToggle(recipe.title).click();
    await expect(list.favoritesStripCard(recipe.title)).toBeVisible();

    await list.deleteRecipe(recipe.title);
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await dialog.confirm();

    await expect(list.card(recipe.title)).toHaveCount(0);
    // regression coverage for item 2h: deleteRecipe() must call
    // favoritesService.remove(id), or the recipe lingers as a ghost favorite.
    await expect(list.favoritesStripCard(recipe.title)).toHaveCount(0);
    await expect(list.favoritesStrip).toHaveCount(0);
  } finally {
    // Best-effort — the UI flow above already deleted it; this is a safety
    // net if an earlier assertion throws before the delete completes.
    await deleteRecipeIfExists(api, recipe.id);
  }
});
