import { Locator, Page } from '@playwright/test';

/**
 * Wraps the shared `<app-confirm-dialog>` (role="alertdialog") used by both
 * the list and detail pages' delete flows.
 */
export class ConfirmDialogPage {
  private readonly dialog: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole('alertdialog');
  }

  async confirm(): Promise<void> {
    await this.dialog.getByRole('button', { name: 'Delete' }).click();
  }

  async cancel(): Promise<void> {
    await this.dialog.getByRole('button', { name: 'Cancel' }).click();
  }

  async isVisible(): Promise<boolean> {
    return this.dialog.isVisible();
  }
}
