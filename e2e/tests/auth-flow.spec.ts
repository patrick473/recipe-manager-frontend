import { expect, test } from '../fixtures/api';
import { LoginPage, RegisterPage } from '../pages/auth.page';
import { RecipeFormPage } from '../pages/recipe-form.page';
import { RecipeListPage } from '../pages/recipe-list.page';

/**
 * Every other e2e spec uses the `test`/`page` fixtures from `../fixtures/api`,
 * which pre-seed localStorage with a valid session before any app script runs
 * (see the comment on the `page` fixture override there) — a deliberate
 * shortcut so specs about *other* features don't have to drive the real
 * login/register forms. This spec is the one place that exercises those
 * forms themselves, plus `authGuard`'s `returnUrl` redirect round-trip
 * (src/app/guards/auth.guard.ts) end to end, so every test here opens a
 * genuinely logged-out browser context via `browser.newContext()` instead —
 * exactly like `recipe-anonymous-access.spec.ts` — while still using the
 * authenticated `api` fixture for out-of-band setup (pre-registering users to
 * log in as, without going through the register form in tests that aren't
 * about registration).
 */

/** Mirrors uniqueCredentials()'s collision-avoidance in fixtures/api.ts (that helper is private to this file). */
function uniqueUsername(label: string): string {
  return `e2e_${label}_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
}

const PASSWORD = 'e2e-test-password-1';

test('registering through the form logs the user in and lands on /recipes', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const register = new RegisterPage(page);
  const list = new RecipeListPage(page);

  try {
    await register.goto();
    await register.fillAndSubmit(uniqueUsername('register'), PASSWORD);

    // Landing on /recipes with no returnUrl set is the success case; the list
    // page itself then syncs its default sort into the URL as a query param,
    // so anchor on the path rather than requiring a bare /recipes.
    await expect(page).toHaveURL(/\/recipes(\?.*)?$/);
    // A visible "New Recipe" link is only rendered for an authenticated
    // session (see recipe-list.component.html), so this also confirms
    // registering actually established a session rather than just navigating.
    await expect(list.newRecipeLink).toBeVisible();
  } finally {
    await context.close();
  }
});

test('logging in through the form with valid credentials lands on /recipes', async ({
  browser,
  api,
}) => {
  const username = uniqueUsername('login-valid');
  const registerResponse = await api.post('/auth/register', {
    data: { username, password: PASSWORD },
  });
  expect(registerResponse.ok()).toBe(true);

  const context = await browser.newContext();
  const page = await context.newPage();
  const login = new LoginPage(page);
  const list = new RecipeListPage(page);

  try {
    await login.goto();
    await login.fillAndSubmit(username, PASSWORD);

    await expect(page).toHaveURL(/\/recipes(\?.*)?$/);
    await expect(list.newRecipeLink).toBeVisible();
  } finally {
    await context.close();
  }
});

test('logging in with the wrong password shows an inline error and stays on the login page', async ({
  browser,
  api,
}) => {
  const username = uniqueUsername('login-invalid');
  const registerResponse = await api.post('/auth/register', {
    data: { username, password: PASSWORD },
  });
  expect(registerResponse.ok()).toBe(true);

  const context = await browser.newContext();
  const page = await context.newPage();
  const login = new LoginPage(page);

  try {
    await login.goto();
    await login.fillAndSubmit(username, 'this-is-the-wrong-password');

    // Regression test for CODE_REVIEW_FIX_SPEC.md item 2f: a 401 from a
    // failed login attempt must surface inline via submitError() and leave
    // the user on the login page — NOT trigger authInterceptor's
    // session-expiry logout+redirect (that path is only for a 401 from an
    // already-authenticated request; /auth/login is in PUBLIC_AUTH_PATHS).
    await expect(login.submitError).toBeVisible();
    await expect(login.submitError).not.toHaveText('');
    await expect(page).toHaveURL(/\/login/);
  } finally {
    await context.close();
  }
});

test('visiting a guarded route while logged out redirects to /login with returnUrl, and a successful login sends the user back there', async ({
  browser,
  api,
}) => {
  const username = uniqueUsername('return-url');
  const registerResponse = await api.post('/auth/register', {
    data: { username, password: PASSWORD },
  });
  expect(registerResponse.ok()).toBe(true);

  const context = await browser.newContext();
  const page = await context.newPage();
  const login = new LoginPage(page);
  const form = new RecipeFormPage(page);

  try {
    await page.goto('/recipes/new');

    await expect(page).toHaveURL(/\/login\?returnUrl=/);
    expect(decodeURIComponent(new URL(page.url()).searchParams.get('returnUrl') ?? '')).toBe(
      '/recipes/new',
    );

    await login.fillAndSubmit(username, PASSWORD);

    // Sent back to the originally-requested guarded route, not the /recipes default.
    await expect(page).toHaveURL(/\/recipes\/new$/);
    await expect(form.titleInput).toBeVisible();
  } finally {
    await context.close();
  }
});

test('a failed login attempt from a returnUrl redirect preserves returnUrl, and a subsequent successful attempt still honors it', async ({
  browser,
  api,
}) => {
  const username = uniqueUsername('return-url-retry');
  const registerResponse = await api.post('/auth/register', {
    data: { username, password: PASSWORD },
  });
  expect(registerResponse.ok()).toBe(true);

  const context = await browser.newContext();
  const page = await context.newPage();
  const login = new LoginPage(page);
  const form = new RecipeFormPage(page);

  try {
    await page.goto('/recipes/new');
    await expect(page).toHaveURL(/\/login\?returnUrl=/);

    // Failed attempt: must not lose returnUrl (this is the exact combination
    // item 2f's bug affected — a bad-credentials 401 used to be treated as a
    // session expiry and redirected to a bare /login, dropping returnUrl).
    await login.fillAndSubmit(username, 'still-the-wrong-password');
    await expect(login.submitError).toBeVisible();
    await expect(page).toHaveURL(/\/login\?returnUrl=/);
    expect(decodeURIComponent(new URL(page.url()).searchParams.get('returnUrl') ?? '')).toBe(
      '/recipes/new',
    );

    // Now retry with the correct password from that same page.
    await login.fillAndSubmit(username, PASSWORD);

    await expect(page).toHaveURL(/\/recipes\/new$/);
    await expect(form.titleInput).toBeVisible();
  } finally {
    await context.close();
  }
});
