import { expect, test, uniqueTitle } from '../fixtures/api';
import { ConfirmDialogPage } from '../pages/confirm-dialog.page';
import { RecipeDetailPage } from '../pages/recipe-detail.page';
import { RecipeFormPage } from '../pages/recipe-form.page';
import { RecipeListPage } from '../pages/recipe-list.page';

test('create -> view -> edit -> delete happy path', async ({ page }) => {
  const title = uniqueTitle('CRUD');
  const editedTitle = `${title} (edited)`;

  const form = new RecipeFormPage(page);
  const detail = new RecipeDetailPage(page);
  const list = new RecipeListPage(page);
  const dialog = new ConfirmDialogPage(page);

  await form.gotoNew();
  await form.fillAndSubmit({
    title,
    description: 'E2E original description',
    content: '## Ingredients\n- flour\n\n## Steps\n1. Preheat the oven.',
  });

  // create redirects to the new recipe's detail page
  await expect(page).toHaveURL(/\/recipes\/\d+$/);
  await expect(detail.heading(title)).toBeVisible();
  await expect(page.getByText('E2E original description')).toBeVisible();
  await expect(detail.content.getByText('flour', { exact: true })).toBeVisible();

  // edit
  await detail.editLink.click();
  await expect(page).toHaveURL(/\/recipes\/\d+\/edit$/);
  await form.fillAndSubmit({
    title: editedTitle,
    content: '## Ingredients\n- sugar\n\n## Steps\n1. Bake it.',
  });

  // edit redirects back to the (same) detail page with changes reflected
  await expect(page).toHaveURL(/\/recipes\/\d+$/);
  await expect(detail.heading(editedTitle)).toBeVisible();
  await expect(detail.content.getByText('sugar', { exact: true })).toBeVisible();

  // delete via the confirm dialog
  await detail.deleteRecipe();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await dialog.confirm();

  // delete redirects to the list, and the recipe is gone
  await expect(page).toHaveURL(/\/recipes(\?.*)?$/);
  await expect(list.card(editedTitle)).toHaveCount(0);
});
