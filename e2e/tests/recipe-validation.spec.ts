import { expect, test } from '../fixtures/api';
import { RecipeFormPage } from '../pages/recipe-form.page';

test('empty title/content shows inline validation and does not navigate away', async ({ page }) => {
  const form = new RecipeFormPage(page);

  await form.gotoNew();
  await form.submit();

  await expect(form.titleRequiredError).toBeVisible();
  await expect(form.contentRequiredError).toBeVisible();
  await expect(page).toHaveURL(/\/recipes\/new$/);
});

test('title over 255 characters shows the maxlength message', async ({ page }) => {
  const form = new RecipeFormPage(page);

  await form.gotoNew();
  await form.fillAndSubmit({ title: 'A'.repeat(256), content: 'Some content.' });

  await expect(form.titleMaxLengthError).toBeVisible();
  await expect(page).toHaveURL(/\/recipes\/new$/);
});

test('a backend-rejected submission surfaces the joined field-error message', async ({ page }) => {
  const form = new RecipeFormPage(page);

  await form.gotoNew();
  // Whitespace-only title satisfies Angular's `Validators.required` (a
  // non-empty string) but fails the backend's `@NotBlank`, forcing a real
  // 400 round-trip through recipe-form.component.ts's error-joining logic.
  await form.fillAndSubmit({ title: '   ', content: 'Some content.' });

  await expect(form.submitError).toBeVisible();
  await expect(form.submitError).toContainText('title:');
  await expect(page).toHaveURL(/\/recipes\/new$/);
});
