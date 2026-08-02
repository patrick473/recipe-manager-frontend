import { deleteRecipeIfExists, expect, seedRecipe, test, uniqueTitle } from '../fixtures/api';
import { RecipeDetailPage } from '../pages/recipe-detail.page';

/**
 * Covers ingredient scaling (recipe-detail.component.ts's canScale/targetServings/
 * scaleFactor computeds + src/app/shared/ingredient-scaling.util.ts), which
 * previously only had unit test coverage. CODE_REVIEW_FIX_SPEC.md item 3f.
 *
 * The scale control's servings stepper and multiplier button group are
 * mutually exclusive in the template (recipe-detail.component.html, the
 * `@if (targetServings(); as servings) { … } @else { … }` inside
 * `@if (canScale())`): the stepper renders when the recipe has a stored
 * `servings` value, the multiplier group renders instead when it doesn't.
 * Visibility of the outer control depends only on `canScale()`, which checks
 * the Markdown content for a recognizable leading-quantity ingredient line —
 * independent of whether `servings` is set.
 */

const SCALABLE_CONTENT = '## Ingredients\n- 2 cups flour\n\n## Steps\n1. Mix it up.';
const NON_SCALABLE_CONTENT = '## Ingredients\n- salt to taste\n\n## Steps\n1. Season it.';

test('recipe with scalable ingredients and stored servings shows the stepper and scales content', async ({
  page,
  api,
}) => {
  const title = uniqueTitle('Scale Stepper');
  const recipe = await seedRecipe(api, { title, content: SCALABLE_CONTENT, servings: 4 });
  const detail = new RecipeDetailPage(page);

  try {
    await detail.goto(recipe.id);
    await expect(detail.heading(title)).toBeVisible();

    await expect(detail.scaleControl).toBeVisible();
    await expect(detail.stepperValue).toHaveText('4');
    await expect(detail.content.getByText('2 cups flour')).toBeVisible();

    // 4 -> 8 servings is a 2x factor: 2 cups * 2 = 4 cups.
    for (let i = 0; i < 4; i++) {
      await detail.increaseServingsButton.click();
    }

    await expect(detail.stepperValue).toHaveText('8');
    await expect(detail.content.getByText('4 cups flour')).toBeVisible();
  } finally {
    await deleteRecipeIfExists(api, recipe.id);
  }
});

test('servings stepper +/- buttons adjust the target and the scaled quantity', async ({
  page,
  api,
}) => {
  const title = uniqueTitle('Scale Stepper Buttons');
  const recipe = await seedRecipe(api, { title, content: SCALABLE_CONTENT, servings: 4 });
  const detail = new RecipeDetailPage(page);

  try {
    await detail.goto(recipe.id);
    await expect(detail.heading(title)).toBeVisible();

    await detail.increaseServingsButton.click();
    await expect(detail.stepperValue).toHaveText('5');
    // 5/4 servings = 1.25x factor: 2 cups * 1.25 = 2.5 cups.
    await expect(detail.content.getByText('2.5 cups flour')).toBeVisible();

    await detail.decreaseServingsButton.click();
    await detail.decreaseServingsButton.click();
    await expect(detail.stepperValue).toHaveText('3');
    // 3/4 servings = 0.75x factor: 2 cups * 0.75 = 1.5 cups.
    await expect(detail.content.getByText('1.5 cups flour')).toBeVisible();
  } finally {
    await deleteRecipeIfExists(api, recipe.id);
  }
});

test('multiplier buttons scale content and highlight the active factor (recipe with no stored servings)', async ({
  page,
  api,
}) => {
  const title = uniqueTitle('Scale Multiplier');
  // No `servings` override -> targetServings() is null -> template renders
  // the multiplier group instead of the stepper.
  const recipe = await seedRecipe(api, { title, content: SCALABLE_CONTENT });
  const detail = new RecipeDetailPage(page);

  try {
    await detail.goto(recipe.id);
    await expect(detail.heading(title)).toBeVisible();

    await expect(detail.scaleControl).toBeVisible();
    await expect(detail.stepperValue).toHaveCount(0);

    const oneX = detail.multiplierButton(1);
    const twoX = detail.multiplierButton(2);

    // scaleFactor() defaults to 1, so the 1x button starts active.
    await expect(oneX).toHaveClass(/btn-primary/);
    await expect(twoX).toHaveClass(/btn-secondary/);
    await expect(detail.content.getByText('2 cups flour')).toBeVisible();

    await twoX.click();

    await expect(twoX).toHaveClass(/btn-primary/);
    await expect(oneX).toHaveClass(/btn-secondary/);
    await expect(detail.content.getByText('4 cups flour')).toBeVisible();
  } finally {
    await deleteRecipeIfExists(api, recipe.id);
  }
});

test('recipe with no scalable ingredients does not show the scale control', async ({
  page,
  api,
}) => {
  const title = uniqueTitle('No Scale');
  const recipe = await seedRecipe(api, { title, content: NON_SCALABLE_CONTENT, servings: 4 });
  const detail = new RecipeDetailPage(page);

  try {
    await detail.goto(recipe.id);
    await expect(detail.heading(title)).toBeVisible();

    // Servings is set, but the content has no leading-quantity ingredient
    // line, so canScale() is false and the whole control is absent.
    await expect(detail.scaleControl).toHaveCount(0);
  } finally {
    await deleteRecipeIfExists(api, recipe.id);
  }
});
