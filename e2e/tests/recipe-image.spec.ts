import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { deleteRecipeIfExists, expect, seedRecipe, test, uniqueTitle } from '../fixtures/api';
import { RecipeDetailPage } from '../pages/recipe-detail.page';
import { RecipeFormPage } from '../pages/recipe-form.page';

/**
 * No image fixture files exist in the repo (checked e2e/ — none), so these
 * are written on the fly to the OS temp dir from minimal-but-valid 1x1 PNG
 * byte literals. Two distinct images (different bytes/size) so the
 * "replace" test can tell the before/after images apart.
 */
const PNG_A_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORkSuQmCC';
const PNG_B_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function writeTempPng(base64: string, name: string): string {
  // fullyParallel runs each test in its own worker process, and each worker
  // runs this describe block's beforeAll/afterAll independently — a
  // Date.now()-based name can collide across workers started in the same
  // millisecond, letting one worker's afterAll delete a file another
  // worker's still-running test needs. A random id per call is collision-free.
  const filePath = path.join(
    os.tmpdir(),
    `recipe-image-e2e-${crypto.randomUUID()}-${name}.png`,
  );
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
  return filePath;
}

/**
 * Matches the recipe-image serving route shape, e.g. `/recipes/42/image` or,
 * with the cache-busting fix, `/recipes/42/image?v=<filename>`. The query
 * param is intentionally optional here — assert on path shape, not on
 * whether cache-busting is present, per the task brief.
 */
function imageUrlPattern(id: number): RegExp {
  return new RegExp(`^/recipes/${id}/image(\\?.*)?$`);
}

test.describe('recipe hero image', () => {
  let imageA: string;
  let imageB: string;

  test.beforeAll(() => {
    imageA = writeTempPng(PNG_A_BASE64, 'a');
    imageB = writeTempPng(PNG_B_BASE64, 'b');
  });

  test.afterAll(() => {
    for (const file of [imageA, imageB]) {
      fs.rmSync(file, { force: true });
    }
  });

  test('uploading a hero image on create shows a preview and renders on the detail page', async ({
    page,
    api,
  }) => {
    const title = uniqueTitle('Image Upload');
    const form = new RecipeFormPage(page);
    const detail = new RecipeDetailPage(page);
    let recipeId: number | undefined;

    try {
      await form.gotoNew();
      await form.fill({ title, content: '## Ingredients\n- flour\n\n## Steps\n1. Mix.' });

      // Before any file is chosen, the empty placeholder is shown.
      await expect(form.imagePreviewEmpty).toBeVisible();
      await expect(form.imagePreview).toHaveCount(0);

      await form.selectImage(imageA);

      // Selecting a file swaps the placeholder for a live (blob:) preview.
      await expect(form.imagePreview).toBeVisible();
      await expect(form.imagePreviewEmpty).toHaveCount(0);

      await form.submit();

      await expect(page).toHaveURL(/\/recipes\/\d+$/);
      const match = page.url().match(/\/recipes\/(\d+)$/);
      recipeId = Number(match![1]);

      // Hero image renders on the detail page's top-level card.
      await expect(detail.heroImage).toBeVisible();
      await expect(detail.heroImage).toHaveAttribute('alt', title);

      const response = await api.get(`/recipes/${recipeId}`);
      expect(response.ok()).toBe(true);
      const saved = await response.json();
      expect(saved.imageUrl).not.toBeNull();
      expect(saved.imageUrl).toMatch(imageUrlPattern(recipeId));
    } finally {
      if (recipeId !== undefined) {
        await deleteRecipeIfExists(api, recipeId);
      }
    }
  });

  test('replacing an existing image on edit updates the preview and persisted URL', async ({
    page,
    api,
  }) => {
    const title = uniqueTitle('Image Replace');
    const recipe = await seedRecipe(api, { title });
    const form = new RecipeFormPage(page);
    const detail = new RecipeDetailPage(page);

    try {
      // First upload establishes the initial image.
      await form.gotoEdit(recipe.id);
      await form.selectImage(imageA);
      await expect(form.imagePreview).toBeVisible();
      const srcAfterFirstSelect = await form.imagePreview.getAttribute('src');
      await form.submit();
      await expect(page).toHaveURL(new RegExp(`/recipes/${recipe.id}$`));

      const firstResponse = await api.get(`/recipes/${recipe.id}`);
      const firstImageUrl: string | null = (await firstResponse.json()).imageUrl;
      expect(firstImageUrl).not.toBeNull();
      expect(firstImageUrl).toMatch(imageUrlPattern(recipe.id));
      const firstServedBytes = (await api.get(`/recipes/${recipe.id}/image`)).body();

      // Second upload (via edit) replaces it.
      await form.gotoEdit(recipe.id);
      // The pre-filled preview should already reflect the persisted image.
      await expect(form.imagePreview).toBeVisible();

      await form.selectImage(imageB);
      const srcAfterReplaceSelect = await form.imagePreview.getAttribute('src');
      // Local preview updates immediately to a new object URL, distinct from
      // both the previous local preview and the persisted server image.
      expect(srcAfterReplaceSelect).not.toBe(srcAfterFirstSelect);

      await form.submit();
      await expect(page).toHaveURL(new RegExp(`/recipes/${recipe.id}$`));

      await expect(detail.heroImage).toBeVisible();

      const secondResponse = await api.get(`/recipes/${recipe.id}`);
      const secondImageUrl: string | null = (await secondResponse.json()).imageUrl;
      expect(secondImageUrl).not.toBeNull();
      expect(secondImageUrl).toMatch(imageUrlPattern(recipe.id));

      // The definitive proof of "replaced" is the served file itself, not the
      // URL string (whose cache-busting `?v=` suffix is being rolled out
      // separately — see imageUrlPattern above): the bytes served for this
      // recipe's image must now be image B's bytes, not image A's.
      const secondServedBytes = (await api.get(`/recipes/${recipe.id}/image`)).body();
      const [firstBuf, secondBuf, expectedA, expectedB] = await Promise.all([
        firstServedBytes,
        secondServedBytes,
        fs.promises.readFile(imageA),
        fs.promises.readFile(imageB),
      ]);
      expect(firstBuf.equals(expectedA)).toBe(true);
      expect(secondBuf.equals(expectedB)).toBe(true);
      expect(secondBuf.equals(firstBuf)).toBe(false);
    } finally {
      await deleteRecipeIfExists(api, recipe.id);
    }
  });

  test('removing an image reverts the preview to empty and clears the persisted URL', async ({
    page,
    api,
  }) => {
    const title = uniqueTitle('Image Remove');
    const recipe = await seedRecipe(api, { title });
    const form = new RecipeFormPage(page);

    try {
      // Give the recipe an image to remove.
      await form.gotoEdit(recipe.id);
      await form.selectImage(imageA);
      await form.submit();
      await expect(page).toHaveURL(new RegExp(`/recipes/${recipe.id}$`));

      const withImage = await api.get(`/recipes/${recipe.id}`);
      expect((await withImage.json()).imageUrl).not.toBeNull();

      // Remove it via the edit form.
      await form.gotoEdit(recipe.id);
      await expect(form.imagePreview).toBeVisible();
      await expect(form.removeImageButton).toBeVisible();

      await form.removeImageButton.click();

      // Preview reverts to the empty placeholder and the button disappears.
      await expect(form.imagePreviewEmpty).toBeVisible();
      await expect(form.imagePreview).toHaveCount(0);
      await expect(form.removeImageButton).toHaveCount(0);

      await form.submit();
      await expect(page).toHaveURL(new RegExp(`/recipes/${recipe.id}$`));

      const afterRemoval = await api.get(`/recipes/${recipe.id}`);
      expect(afterRemoval.ok()).toBe(true);
      expect((await afterRemoval.json()).imageUrl).toBeNull();

      // The image itself is no longer served either.
      const imageResponse = await api.get(`/recipes/${recipe.id}/image`);
      expect(imageResponse.status()).toBe(404);
    } finally {
      await deleteRecipeIfExists(api, recipe.id);
    }
  });
});
