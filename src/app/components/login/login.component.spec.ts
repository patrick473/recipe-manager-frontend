import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../services/auth.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let fakeAuthService: { login: ReturnType<typeof vi.fn> };
  let fakeRouter: { navigateByUrl: ReturnType<typeof vi.fn> };

  function configure(returnUrl: string | null) {
    const fakeRoute = {
      snapshot: {
        queryParamMap: {
          get: (key: string) => (key === 'returnUrl' ? returnUrl : null),
        },
      },
    } as unknown as ActivatedRoute;

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: fakeAuthService },
        { provide: Router, useValue: fakeRouter },
        { provide: ActivatedRoute, useValue: fakeRoute },
      ],
    });
  }

  beforeEach(() => {
    fakeAuthService = { login: vi.fn() };
    fakeRouter = { navigateByUrl: vi.fn() };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is a no-op and marks all controls as touched when the form is invalid', () => {
    configure(null);

    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component['onSubmit']();

    expect(fakeAuthService.login).not.toHaveBeenCalled();
    expect(component['form'].touched).toBe(true);
  });

  it('valid submit calls AuthService.login() and navigates to returnUrl on success', () => {
    fakeAuthService.login.mockReturnValue(of({ token: 't', userId: 1, username: 'alice' }));
    configure('/recipes/42');

    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component['form'].setValue({ username: 'alice', password: 'password123' });
    component['onSubmit']();

    expect(fakeAuthService.login).toHaveBeenCalledWith('alice', 'password123');
    expect(fakeRouter.navigateByUrl).toHaveBeenCalledWith('/recipes/42');
  });

  it('valid submit navigates to /recipes when there is no returnUrl', () => {
    fakeAuthService.login.mockReturnValue(of({ token: 't', userId: 1, username: 'alice' }));
    configure(null);

    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component['form'].setValue({ username: 'alice', password: 'password123' });
    component['onSubmit']();

    expect(fakeRouter.navigateByUrl).toHaveBeenCalledWith('/recipes');
  });

  it('a 401 ProblemDetail renders the detail message and does not navigate', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fakeAuthService.login.mockReturnValue(
      throwError(() => ({ status: 401, error: { detail: 'Invalid username or password.' } })),
    );
    configure(null);

    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component['form'].setValue({ username: 'alice', password: 'wrongpassword' });
    component['onSubmit']();

    expect(component['submitError']()).toBe('Invalid username or password.');
    expect(fakeRouter.navigateByUrl).not.toHaveBeenCalled();
    expect(component['submitting']()).toBe(false);
  });

  it('falls back to a generic message when the ProblemDetail has no detail field', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fakeAuthService.login.mockReturnValue(throwError(() => ({ status: 401, error: {} })));
    configure(null);

    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component['form'].setValue({ username: 'alice', password: 'wrongpassword' });
    component['onSubmit']();

    expect(component['submitError']()).toBe('Invalid username or password.');
  });
});
