import { Locator, Page } from '@playwright/test';

/** Shared field/error locators for the login and register forms — see login.component.html / register.component.html. */
abstract class AuthFormPage {
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly submitError: Locator;

  constructor(
    protected readonly page: Page,
    submitButtonName: RegExp,
  ) {
    this.usernameInput = page.locator('#username');
    this.passwordInput = page.locator('#password');
    this.submitButton = page.getByRole('button', { name: submitButtonName });
    this.submitError = page.locator('.notification.notification-negative');
  }

  async fill(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  async fillAndSubmit(username: string, password: string): Promise<void> {
    await this.fill(username, password);
    await this.submit();
  }
}

export class LoginPage extends AuthFormPage {
  constructor(page: Page) {
    super(page, /Log in|Logging in/);
  }

  /** `path` lets callers navigate straight to `/login?returnUrl=...` for returnUrl round-trip tests. */
  async goto(path = '/login'): Promise<void> {
    await this.page.goto(path);
  }
}

export class RegisterPage extends AuthFormPage {
  constructor(page: Page) {
    super(page, /Register|Registering/);
  }

  async goto(path = '/register'): Promise<void> {
    await this.page.goto(path);
  }
}
