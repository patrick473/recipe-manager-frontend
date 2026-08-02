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
  readonly heroImage: Locator;
  /** Wraps either the servings stepper or the multiplier group, whichever the recipe's `servings` presence selects — see recipe-detail.component.html. */
  readonly scaleControl: Locator;
  readonly decreaseServingsButton: Locator;
  readonly increaseServingsButton: Locator;
  readonly stepperValue: Locator;
  /** Accessible name flips between "Add to favorites" / "Remove from favorites". */
  readonly favoriteToggle: Locator;

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
    // Top-level hero image on the detail card (recipe-detail.component.html),
    // distinct from the smaller thumbnail shown in list/recently-viewed cards.
    this.heroImage = page.locator('.detail-hero');
    this.scaleControl = page.locator('.scale-control');
    this.decreaseServingsButton = page.getByRole('button', { name: 'Decrease servings' });
    this.increaseServingsButton = page.getByRole('button', { name: 'Increase servings' });
    this.stepperValue = page.locator('.stepper-value');
    this.favoriteToggle = page.getByRole('button', { name: /favorites/i });
  }

  /** Locates a "0.5×" / "2×" style multiplier button by its numeric factor. */
  multiplierButton(factor: number): Locator {
    return this.page.getByRole('button', { name: `${factor}×`, exact: true });
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
