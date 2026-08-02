import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authService: AuthService;
  let router: Router;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('attaches an Authorization header when a token is present', () => {
    authService.token.set('my-token');

    http.get('/recipes').subscribe();

    const req = httpMock.expectOne('/recipes');
    expect(req.request.headers.get('Authorization')).toBe('Bearer my-token');
    req.flush({});
  });

  it('omits the Authorization header when no token is present', () => {
    http.get('/recipes').subscribe();

    const req = httpMock.expectOne('/recipes');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('omits the Authorization header for /auth/login even when a token is present', () => {
    authService.token.set('my-token');

    http.post('/auth/login', { username: 'a', password: 'b' }).subscribe();

    const req = httpMock.expectOne('/auth/login');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('omits the Authorization header for /auth/register even when a token is present', () => {
    authService.token.set('my-token');

    http.post('/auth/register', { username: 'a', password: 'b' }).subscribe();

    const req = httpMock.expectOne('/auth/register');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('on a 401 response, logs out and navigates to /login, then re-throws the error', () => {
    authService.token.set('my-token');
    const logoutSpy = vi.spyOn(authService, 'logout');
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    let error: unknown;

    http.get('/recipes').subscribe({
      next: () => {
        throw new Error('expected an error, got a value');
      },
      error: (err) => (error = err),
    });

    const req = httpMock.expectOne('/recipes');
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(logoutSpy).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith('/login');
    expect((error as { status: number }).status).toBe(401);
  });

  it('does not log out or navigate on a non-401 error response', () => {
    authService.token.set('my-token');
    const logoutSpy = vi.spyOn(authService, 'logout');
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    let error: unknown;
    http.get('/recipes').subscribe({
      next: () => {
        throw new Error('expected an error, got a value');
      },
      error: (err) => (error = err),
    });

    const req = httpMock.expectOne('/recipes');
    req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });

    expect((error as { status: number }).status).toBe(500);

    expect(logoutSpy).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('does not log out or navigate on a 401 from /auth/login (bad credentials)', () => {
    const logoutSpy = vi.spyOn(authService, 'logout');
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    let error: unknown;
    http.post('/auth/login', { username: 'a', password: 'wrong' }).subscribe({
      next: () => {
        throw new Error('expected an error, got a value');
      },
      error: (err) => (error = err),
    });

    const req = httpMock.expectOne('/auth/login');
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect((error as { status: number }).status).toBe(401);

    expect(logoutSpy).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('still logs out and navigates on a 401 from an authenticated endpoint', () => {
    authService.token.set('my-token');
    const logoutSpy = vi.spyOn(authService, 'logout');
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    let error: unknown;
    http.get('/recipes').subscribe({
      next: () => {
        throw new Error('expected an error, got a value');
      },
      error: (err) => (error = err),
    });

    const req = httpMock.expectOne('/recipes');
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect((error as { status: number }).status).toBe(401);

    expect(logoutSpy).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith('/login');
  });
});
