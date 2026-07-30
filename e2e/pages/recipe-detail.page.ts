import { Locator, Page } from '@playwright/test';

export class RecipeDetailPage {
  readonly editLink: Locator;
  readonly deleteButton: Locator;
  readonly printButton: Locator;
  readonly backToListLink: Locator;
  /** Rendered Markdown -> arbitrary HTML, no stable role/label to key off. */
  readonly content: Locator;
  readonly breadcrumbs: Locator;
  readonly detailActions: Locator;
  readonly propertiesToggle: Locator;
  readonly propertiesBody: Locator;

  constructor(private readonly page: Page) {
    this.editLink = page.getByRole('link', { name: 'Edit' });
    this.deleteButton = page.getByRole('button', { name: /Delete/ });
    this.printButton = page.getByRole('button', { name: 'Print' });
    this.backToListLink = page.getByRole('link', { name: 'Recipes' });
    this.content = page.locator('.markdown-body');
    this.breadcrumbs = page.locator('.breadcrumbs');
    this.detailActions = page.locator('.detail-actions');
    this.propertiesToggle = page.getByRole('button', { name: 'Properties' });
    this.propertiesBody = page.locator('.properties-body');
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
