import { Locator, Page } from '@playwright/test';

export class RecipeListPage {
  readonly heading: Locator;
  readonly newRecipeLink: Locator;
  readonly emptyStateHeading: Locator;
  readonly errorNotification: Locator;
  readonly loader: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Recipes', exact: true });
    this.newRecipeLink = page.getByRole('link', { name: 'New Recipe' });
    this.emptyStateHeading = page.getByRole('heading', { name: 'No recipes yet' });
    this.errorNotification = page.getByText('Failed to load recipes. Is the backend running?');
    this.loader = page.getByText('Loading recipes…');
  }

  async goto(): Promise<void> {
    await this.page.goto('/recipes');
  }

  /** Scopes to the card containing the recipe's title heading — no per-card ARIA container exists to key off instead. */
  card(title: string): Locator {
    return this.page
      .locator('.recipe-card')
      .filter({ has: this.page.getByRole('heading', { name: title, exact: true }) });
  }

  titleLink(title: string): Locator {
    return this.card(title).getByRole('link', { name: title, exact: true });
  }

  editLink(title: string): Locator {
    return this.card(title).getByRole('link', { name: 'Edit' });
  }

  deleteButton(title: string): Locator {
    return this.card(title).getByRole('button', { name: /Delete/ });
  }

  async deleteRecipe(title: string): Promise<void> {
    await this.deleteButton(title).click();
  }
}
