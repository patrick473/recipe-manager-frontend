import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

const PUBLIC_AUTH_PATHS = ['/auth/register', '/auth/login'];

/**
 * Attaches `Authorization: Bearer <token>` to every outgoing request that
 * isn't itself a register/login call, and on a `401` response clears the
 * stored session and redirects to `/login` — the simplest correct behavior
 * for a fixed-expiry token with no refresh flow.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const token = authService.token();
  const isPublicAuthRequest = PUBLIC_AUTH_PATHS.some((path) => req.url.includes(path));

  const authorizedReq =
    token && !isPublicAuthRequest
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(authorizedReq).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        authService.logout();
        router.navigateByUrl('/login');
      }
      return throwError(() => error);
    }),
  );
};
