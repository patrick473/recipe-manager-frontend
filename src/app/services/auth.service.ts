import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuthService as GeneratedAuthService } from '../api/generated/auth/auth.service';
import { AuthResponse } from '../models/auth.model';

const STORAGE_KEY = 'auth';

interface StoredAuth {
  token: string;
  userId: number;
  username: string;
}

/**
 * Wraps the Orval-generated auth API client and owns the client-side
 * session: a signed-in user's `{ token, userId, username }` is persisted as
 * one JSON blob in `localStorage` (mirroring `favorites.service.ts`/
 * `theme.service.ts`) and mirrored into signals so components can react to
 * sign-in/sign-out without re-reading storage.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(GeneratedAuthService);

  readonly currentUser = signal<{ userId: number; username: string } | null>(this.readStoredUser());
  readonly token = signal<string | null>(this.readStoredToken());

  readonly isAuthenticated = computed(() => this.token() !== null);

  /** POST /auth/login — on success, persists the session and updates signals. */
  login(username: string, password: string): Observable<AuthResponse> {
    return this.api
      .login({ username, password })
      .pipe(tap((response) => this.storeSession(response)));
  }

  /** POST /auth/register — on success, persists the session and updates signals. */
  register(username: string, password: string): Observable<AuthResponse> {
    return this.api
      .register({ username, password })
      .pipe(tap((response) => this.storeSession(response)));
  }

  /**
   * Clears the stored session and signals. No server round-trip — there's
   * no session to invalidate server-side with a stateless JWT.
   */
  logout(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.token.set(null);
    this.currentUser.set(null);
  }

  private storeSession(response: AuthResponse): void {
    const stored: StoredAuth = {
      token: response.token,
      userId: response.userId,
      username: response.username,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    this.token.set(stored.token);
    this.currentUser.set({ userId: stored.userId, username: stored.username });
  }

  private readStoredAuth(): StoredAuth | null {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    try {
      const parsed: unknown = JSON.parse(stored);
      if (
        parsed !== null &&
        typeof parsed === 'object' &&
        typeof (parsed as Partial<StoredAuth>).token === 'string' &&
        typeof (parsed as Partial<StoredAuth>).userId === 'number' &&
        typeof (parsed as Partial<StoredAuth>).username === 'string'
      ) {
        return parsed as StoredAuth;
      }
      return null;
    } catch {
      return null;
    }
  }

  private readStoredToken(): string | null {
    return this.readStoredAuth()?.token ?? null;
  }

  private readStoredUser(): { userId: number; username: string } | null {
    const stored = this.readStoredAuth();
    return stored ? { userId: stored.userId, username: stored.username } : null;
  }
}
