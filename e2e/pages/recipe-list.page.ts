import { Locator, Page } from '@playwright/test';

export class RecipeListPage {
  readonly heading: Locator;
  readonly newRecipeLink: Locator;
  readonly emptyStateHeading: Locator;
  readonly errorNotification: Locator;
  readonly loader: Locator;
  /** The "Recently viewed" strip — a `<section aria-label="Recently viewed">`, only rendered when non-empty. */
  readonly recentlyViewedSection: Locator;
  readonly clearRecentlyViewedButton: Locator;
  /** The "Favorites" strip — a `<section aria-label="Favorites">`, only rendered when non-empty. */
  readonly favoritesStrip: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Recipes', exact: true });
    this.newRecipeLink = page.getByRole('link', { name: 'New Recipe' });
    this.emptyStateHeading = page.getByRole('heading', { name: 'No recipes yet' });
    this.errorNotification = page.getByText('Failed to load recipes. Is the backend running?');
    this.loader = page.getByText('Loading recipes…');
    this.recentlyViewedSection = page.getByRole('region', { name: 'Recently viewed' });
    this.clearRecentlyViewedButton = this.recentlyViewedSection.getByRole('button', {
      name: 'Clear',
    });
    // A <section> with an aria-label has an implicit ARIA role of "region".
    this.favoritesStrip = page.getByRole('region', { name: 'Favorites' });
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

  /**
   * Favorite toggle button within a card in the main grid/list (works for
   * both view modes — same markup/handler in each). Accessible name flips
   * between "Add to favorites" / "Remove from favorites", so match loosely.
   */
  favoriteToggle(title: string): Locator {
    return this.card(title).getByRole('button', { name: /favorites/i });
  }

  /** The clickable card link within the "Recently viewed" strip — no per-card ARIA container, so scope by contained title text. */
  recentlyViewedCard(title: string): Locator {
    return this.recentlyViewedSection
      .locator('.recipe-strip-card-link')
      .filter({ has: this.page.getByText(title, { exact: true }) });
  }

  /** Scopes to a card within the "Favorites" strip, keyed by its title text — no per-card ARIA container to key off instead. */
  favoritesStripCard(title: string): Locator {
    return this.favoritesStrip
      .locator('.recipe-strip-card')
      .filter({ has: this.page.getByText(title, { exact: true }) });
  }

  /** Favorite toggle button within the Favorites strip's card for `title`. */
  favoritesStripToggle(title: string): Locator {
    return this.favoritesStripCard(title).getByRole('button', { name: /favorites/i });
  }
}
