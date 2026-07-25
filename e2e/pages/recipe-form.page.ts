import { Locator, Page } from '@playwright/test';

export interface RecipeFormData {
  title?: string;
  description?: string;
  content?: string;
}

export class RecipeFormPage {
  readonly titleInput: Locator;
  readonly descriptionInput: Locator;
  readonly contentInput: Locator;
  readonly submitButton: Locator;
  readonly cancelLink: Locator;

  readonly titleRequiredError: Locator;
  readonly titleMaxLengthError: Locator;
  readonly contentRequiredError: Locator;
  readonly submitError: Locator;

  constructor(private readonly page: Page) {
    this.titleInput = page.getByLabel(/^Title/);
    this.descriptionInput = page.getByLabel(/^Description/);
    this.contentInput = page.getByLabel(/^Content/);
    this.submitButton = page.getByRole('button', {
      name: /Create Recipe|Save Changes|Saving/,
    });
    this.cancelLink = page.getByRole('link', { name: 'Cancel' });

    this.titleRequiredError = page.getByText('Title is required.');
    this.titleMaxLengthError = page.getByText('Title must not exceed 255 characters.');
    this.contentRequiredError = page.getByText('Content is required.');
    this.submitError = page.getByText(/Validation failed|Failed to save recipe/);
  }

  async gotoNew(): Promise<void> {
    await this.page.goto('/recipes/new');
  }

  async gotoEdit(id: number | string): Promise<void> {
    await this.page.goto(`/recipes/${id}/edit`);
  }

  async fill(data: RecipeFormData): Promise<void> {
    if (data.title !== undefined) await this.titleInput.fill(data.title);
    if (data.description !== undefined) await this.descriptionInput.fill(data.description);
    if (data.content !== undefined) await this.contentInput.fill(data.content);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  async fillAndSubmit(data: RecipeFormData): Promise<void> {
    await this.fill(data);
    await this.submit();
  }
}
