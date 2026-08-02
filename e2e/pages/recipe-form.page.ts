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

  readonly imageInput: Locator;
  readonly imagePreview: Locator;
  readonly imagePreviewEmpty: Locator;
  readonly removeImageButton: Locator;
  readonly imageError: Locator;

  constructor(private readonly page: Page) {
    this.titleInput = page.getByLabel(/^Title/);
    this.descriptionInput = page.getByLabel(/^Description/);
    // Not getByLabel(/^Content/): the "Content (Markdown)" label's `for="content"`
    // targets <app-markdown-editor id="content">, but that custom element isn't a
    // native labelable control, so the label never associates with the actual
    // role="textbox" CodeMirror div inside it (which itself carries no accessible
    // name) — getByLabel resolves to zero matches. Target CodeMirror's editable
    // surface directly instead; Playwright's .fill() supports [contenteditable].
    this.contentInput = page.locator('#content .cm-content');
    this.submitButton = page.getByRole('button', {
      name: /Create Recipe|Save Changes|Saving/,
    });
    this.cancelLink = page.getByRole('link', { name: 'Cancel' });

    this.titleRequiredError = page.getByText('Title is required.');
    this.titleMaxLengthError = page.getByText('Title must not exceed 255 characters.');
    this.contentRequiredError = page.getByText('Content is required.');
    this.submitError = page.getByText(/Validation failed|Failed to save recipe/);

    this.imageInput = page.locator('#image');
    // Both the populated and empty states share the `.image-preview` class
    // (see recipe-form.component.html) — scope to the `<img>` element itself
    // vs. the empty-state placeholder `<div>` to tell them apart.
    this.imagePreview = page.locator('img.image-preview');
    this.imagePreviewEmpty = page.locator('div.image-preview-empty');
    this.removeImageButton = page.getByRole('button', { name: 'Remove image' });
    this.imageError = page.locator('.field-error').last();
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

  async selectImage(filePath: string): Promise<void> {
    await this.imageInput.setInputFiles(filePath);
  }
}
