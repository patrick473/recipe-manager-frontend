import { deleteRecipeIfExists, expect, test, uniqueTitle } from '../fixtures/api';
import { RecipeDetailPage } from '../pages/recipe-detail.page';

/**
 * Covers PRINT_FRIENDLY_RECIPE_VIEW_SPEC.md's Testing section. `@media print`
 * rendering can't be evaluated by the Vitest/jsdom unit tests, so this is the
 * one place actually verifying the print CSS and the force-expand behavior.
 */

test('print media hides chrome but keeps the recipe title and content', async ({ page, api }) => {
  const title = uniqueTitle('Print View');
  const seeded = await api.post('/recipes', {
    data: {
      title,
      description: 'E2E print test description',
      content: '## Ingredients\n- flour\n\n## Steps\n1. Preheat the oven.',
    },
  });
  const recipe: { id: number } = await seeded.json();

  const detail = new RecipeDetailPage(page);
  await detail.goto(recipe.id);
  await expect(detail.heading(title)).toBeVisible();

  await page.emulateMedia({ media: 'print' });

  await expect(page.locator('.side-nav')).toBeHidden();
  await expect(detail.detailActions).toBeHidden();
  await expect(detail.breadcrumbs).toBeHidden();

  await expect(detail.heading(title)).toBeVisible();
  await expect(detail.content).toBeVisible();

  await deleteRecipeIfExists(api, recipe.id);
});

test('Print button force-expands a collapsed properties panel', async ({ page, api }) => {
  const title = uniqueTitle('Print Expand');
  const seeded = await api.post('/recipes', {
    data: {
      title,
      description: 'E2E print test description',
      content: '## Ingredients\n- flour\n\n## Steps\n1. Preheat the oven.',
      servings: 4,
      prepTimeMinutes: 10,
    },
  });
  const recipe: { id: number } = await seeded.json();

  // Stub window.print before any app script runs, so clicking Print never
  // opens the real OS print dialog during the test run.
  await page.addInitScript(() => {
    // @ts-expect-error - test-only stub, not the real Window.print signature
    window.print = () => ((window as unknown as { __printCalled: boolean }).__printCalled = true);
  });

  const detail = new RecipeDetailPage(page);
  await detail.goto(recipe.id);
  await expect(detail.heading(title)).toBeVisible();

  // Collapse the panel (it starts expanded) before printing.
  await detail.propertiesToggle.click();
  await expect(detail.propertiesBody).toHaveCount(0);

  await detail.printButton.click();

  await expect(detail.propertiesBody).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __printCalled?: boolean }).__printCalled),
    )
    .toBe(true);

  await deleteRecipeIfExists(api, recipe.id);
});
