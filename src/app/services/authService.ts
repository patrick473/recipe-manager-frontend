import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuthService as GeneratedAuthService } from '../api/generated/auth/auth.service';
import { AuthResponse } from '../models/auth.model';
import { FavoritesService } from './favorites.service';
import { RecentlyViewedService } from './recently-viewed.service';

const STORAGE_KEY = 'auth';

interface StoredAuth {
  token: string;
  userId: number;
  username: string;
}

/**
 * Service responsible for handling authentication logic, including user session
 * persistence and expose authentication state.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(GeneratedAuthService);
  private readonly favoritesService = inject(FavoritesService);
  private readonly recentlyViewedService = inject(RecentlyViewedService);

  readonly currentUser = signal<{ userId: number; username: string } | null>(this.readStoredUser());
  readonly token = signal<string | null>(this.readStoredToken());

  readonly isAuthenticated = computed(() => this.token() !== null);

  /**
   * Performs login operation and persists session on success.
   */
  login(username: string, password: string): Observable<AuthResponse> {
    return this.api
      .login({ username, password })
      .pipe(tap((response) => this.storeSession(response)));
  }

  /**
   * Performs registration and persists session on success.
   */
  register(username: string, password: string): Observable<AuthResponse> {
    return this.api
      .register({ username, password })
      .pipe(tap((response) => this.storeSession(response)));
  }

  /**
   * Clears the session state including persisted storage and service signals.
   */
  logout(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.token.set(null);
    this.currentUser.set(null);
    this.favoritesService.clear();
    this.recentlyViewedService.clear();
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
