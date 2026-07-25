import { expect, test } from '../fixtures/api';
import { RecipeDetailPage } from '../pages/recipe-detail.page';

test('navigating to a nonexistent recipe id shows a not-found message', async ({ page }) => {
  const detail = new RecipeDetailPage(page);

  await detail.goto(999999);

  await expect(page.getByText('Recipe #999999 was not found.')).toBeVisible();
  await expect(detail.backToListLink).toBeVisible();
});
