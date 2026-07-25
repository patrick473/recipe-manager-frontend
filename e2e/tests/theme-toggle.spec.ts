import { expect, test } from '@playwright/test';

test('toggling the theme flips data-theme and persists across reload', async ({ page }) => {
  await page.goto('/recipes');

  const initialTheme = await page.evaluate(() =>
    document.documentElement.getAttribute('data-theme'),
  );
  await page.getByRole('button', { name: /Switch to (light|dark) theme/ }).click();

  const toggledTheme = await page.evaluate(() =>
    document.documentElement.getAttribute('data-theme'),
  );
  expect(toggledTheme).not.toBe(initialTheme);

  await page.reload();

  const themeAfterReload = await page.evaluate(() =>
    document.documentElement.getAttribute('data-theme'),
  );
  expect(themeAfterReload).toBe(toggledTheme);

  const stored = await page.evaluate(() => localStorage.getItem('theme'));
  expect(stored).toBe(toggledTheme);
});

test('an unknown path redirects to /recipes', async ({ page }) => {
  await page.goto('/nonexistent');

  await expect(page).toHaveURL(/\/recipes$/);
});
