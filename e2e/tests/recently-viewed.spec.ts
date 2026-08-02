import { deleteRecipeIfExists, expect, seedRecipe, test, uniqueTitle } from '../fixtures/api';
import { ConfirmDialogPage } from '../pages/confirm-dialog.page';
import { RecipeDetailPage } from '../pages/recipe-detail.page';
import { RecipeListPage } from '../pages/recipe-list.page';

/**
 * RecentlyViewedService (src/app/services/recently-viewed.service.ts) is
 * localStorage-backed with no per-user separation, so — unlike most specs in
 * this suite — its state isn't isolated by the fresh-user-per-test fixture.
 * Each test here stays self-contained by only asserting on the recipe(s) it
 * itself seeded and recorded, and cleans up (both the seeded recipe and the
 * recently-viewed entry) so it can't leak into a sibling test.
 */

test('viewing a recipe adds it to the "Recently viewed" strip on the list page', async ({
  page,
  api,
}) => {
  const recipe = await seedRecipe(api, { title: uniqueTitle('Recently Viewed') });
  const list = new RecipeListPage(page);
  const detail = new RecipeDetailPage(page);

  try {
    // Visiting the detail page is what records the view (recipe-detail.component.ts ngOnInit).
    await detail.goto(recipe.id);
    await expect(detail.heading(recipe.title)).toBeVisible();

    await list.goto();
    await expect(list.recentlyViewedSection).toBeVisible();
    await expect(list.recentlyViewedCard(recipe.title)).toBeVisible();
  } finally {
    await deleteRecipeIfExists(api, recipe.id);
  }
});

test('the "Clear" action empties the Recently Viewed strip', async ({ page, api }) => {
  const recipe = await seedRecipe(api, { title: uniqueTitle('Recently Viewed Clear') });
  const list = new RecipeListPage(page);
  const detail = new RecipeDetailPage(page);

  try {
    await detail.goto(recipe.id);
    await expect(detail.heading(recipe.title)).toBeVisible();

    await list.goto();
    await expect(list.recentlyViewedCard(recipe.title)).toBeVisible();

    await list.clearRecentlyViewedButton.click();
    await expect(list.recentlyViewedSection).toHaveCount(0);
  } finally {
    await deleteRecipeIfExists(api, recipe.id);
  }
});

test('recently-viewed state persists across a page reload', async ({ page, api }) => {
  const recipe = await seedRecipe(api, { title: uniqueTitle('Recently Viewed Reload') });
  const list = new RecipeListPage(page);
  const detail = new RecipeDetailPage(page);

  try {
    await detail.goto(recipe.id);
    await expect(detail.heading(recipe.title)).toBeVisible();

    await list.goto();
    await expect(list.recentlyViewedCard(recipe.title)).toBeVisible();

    await page.reload();
    await expect(list.recentlyViewedCard(recipe.title)).toBeVisible();
  } finally {
    await deleteRecipeIfExists(api, recipe.id);
  }
});

test('deleting a recently-viewed recipe removes it from the strip', async ({ page, api }) => {
  const recipe = await seedRecipe(api, { title: uniqueTitle('Recently Viewed Delete') });
  const list = new RecipeListPage(page);
  const detail = new RecipeDetailPage(page);
  const dialog = new ConfirmDialogPage(page);

  try {
    await detail.goto(recipe.id);
    await expect(detail.heading(recipe.title)).toBeVisible();

    await list.goto();
    await expect(list.recentlyViewedCard(recipe.title)).toBeVisible();

    // Delete via the main grid's delete control (RecentlyViewedService.remove()
    // is called on successful delete — recipe-list.component.ts deleteRecipe()).
    await list.deleteRecipe(recipe.title);
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await dialog.confirm();

    await expect(list.card(recipe.title)).toHaveCount(0);
    await expect(list.recentlyViewedCard(recipe.title)).toHaveCount(0);
  } finally {
    await deleteRecipeIfExists(api, recipe.id);
  }
});
