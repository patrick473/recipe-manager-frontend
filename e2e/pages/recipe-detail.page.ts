import { Locator, Page } from '@playwright/test';

export class RecipeDetailPage {
  readonly editLink: Locator;
  readonly deleteButton: Locator;
  readonly backToListLink: Locator;
  /** Rendered Markdown -> arbitrary HTML, no stable role/label to key off. */
  readonly content: Locator;

  constructor(private readonly page: Page) {
    this.editLink = page.getByRole('link', { name: 'Edit' });
    this.deleteButton = page.getByRole('button', { name: /Delete/ });
    this.backToListLink = page.getByRole('link', { name: 'Recipes' });
    this.content = page.locator('.markdown-body');
  }

  async goto(id: number | string): Promise<void> {
    await this.page.goto(`/recipes/${id}`);
  }

  heading(title: string): Locator {
    return this.page.getByRole('heading', { name: title, level: 1 });
  }

  async deleteRecipe(): Promise<void> {
    await this.deleteButton.click();
  }
}
