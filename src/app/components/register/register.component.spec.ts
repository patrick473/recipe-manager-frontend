import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../services/auth.service';
import { RegisterComponent } from './register.component';

describe('RegisterComponent', () => {
  let fakeAuthService: { register: ReturnType<typeof vi.fn> };
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
    fakeAuthService = { register: vi.fn() };
    fakeRouter = { navigateByUrl: vi.fn() };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is a no-op and marks all controls as touched when the form is invalid', () => {
    configure(null);

    const fixture = TestBed.createComponent(RegisterComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component['onSubmit']();

    expect(fakeAuthService.register).not.toHaveBeenCalled();
    expect(component['form'].touched).toBe(true);
  });

  it('reports the minlength message when password is under 8 characters and touched', () => {
    configure(null);

    const fixture = TestBed.createComponent(RegisterComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component['form'].get('password')?.setValue('short');
    component['form'].get('password')?.markAsTouched();

    expect(component['isInvalid']('password')).toBe(true);
    expect(component['passwordError']).toBe('Password must be at least 8 characters.');
  });

  it('valid submit calls AuthService.register() and navigates to returnUrl on success', () => {
    fakeAuthService.register.mockReturnValue(of({ token: 't', userId: 1, username: 'alice' }));
    configure('/recipes/new');

    const fixture = TestBed.createComponent(RegisterComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component['form'].setValue({ username: 'alice', password: 'password123' });
    component['onSubmit']();

    expect(fakeAuthService.register).toHaveBeenCalledWith('alice', 'password123');
    expect(fakeRouter.navigateByUrl).toHaveBeenCalledWith('/recipes/new');
  });

  it('valid submit navigates to /recipes when there is no returnUrl', () => {
    fakeAuthService.register.mockReturnValue(of({ token: 't', userId: 1, username: 'alice' }));
    configure(null);

    const fixture = TestBed.createComponent(RegisterComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component['form'].setValue({ username: 'alice', password: 'password123' });
    component['onSubmit']();

    expect(fakeRouter.navigateByUrl).toHaveBeenCalledWith('/recipes');
  });

  it('a 409 ProblemDetail (taken username) renders the detail message and does not navigate', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fakeAuthService.register.mockReturnValue(
      throwError(() => ({ status: 409, error: { detail: 'Username is already taken.' } })),
    );
    configure(null);

    const fixture = TestBed.createComponent(RegisterComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component['form'].setValue({ username: 'alice', password: 'password123' });
    component['onSubmit']();

    expect(component['submitError']()).toBe('Username is already taken.');
    expect(fakeRouter.navigateByUrl).not.toHaveBeenCalled();
    expect(component['submitting']()).toBe(false);
  });

  it('falls back to a generic message when the ProblemDetail has no detail field', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fakeAuthService.register.mockReturnValue(throwError(() => ({ status: 409, error: {} })));
    configure(null);

    const fixture = TestBed.createComponent(RegisterComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component['form'].setValue({ username: 'alice', password: 'password123' });
    component['onSubmit']();

    expect(component['submitError']()).toBe('Registration failed. Please try again.');
  });
});
