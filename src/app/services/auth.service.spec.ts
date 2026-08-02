import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthResponse } from '../models/auth.model';
import { AuthService } from './auth.service';
import { FavoritesService } from './favorites.service';
import { RecentlyViewedService } from './recently-viewed.service';

const mockAuthResponse: AuthResponse = {
  token: 'jwt-token-value',
  userId: 1,
  username: 'alice',
};

describe('AuthService', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe('construction / rehydration', () => {
    it('rehydrates token/currentUser from a pre-existing localStorage value', () => {
      localStorage.setItem(
        'auth',
        JSON.stringify({ token: 'stored-token', userId: 5, username: 'bob' }),
      );

      const service = TestBed.inject(AuthService);

      expect(service.token()).toBe('stored-token');
      expect(service.currentUser()).toEqual({ userId: 5, username: 'bob' });
      expect(service.isAuthenticated()).toBe(true);
    });

    it('starts unauthenticated when localStorage has no stored value', () => {
      const service = TestBed.inject(AuthService);

      expect(service.token()).toBeNull();
      expect(service.currentUser()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
    });

    it('starts unauthenticated without throwing when the stored value is invalid JSON', () => {
      localStorage.setItem('auth', 'not valid json{');

      expect(() => TestBed.inject(AuthService)).not.toThrow();
      const service = TestBed.inject(AuthService);
      expect(service.token()).toBeNull();
      expect(service.currentUser()).toBeNull();
    });

    it('starts unauthenticated without throwing when the stored value has the wrong shape', () => {
      localStorage.setItem('auth', JSON.stringify({ not: 'the right shape' }));

      const service = TestBed.inject(AuthService);

      expect(service.token()).toBeNull();
      expect(service.currentUser()).toBeNull();
    });
  });

  describe('login()', () => {
    it('persists the session to localStorage and updates signals on success', () => {
      const service = TestBed.inject(AuthService);
      let result: AuthResponse | undefined;

      service.login('alice', 'password123').subscribe((r) => (result = r));

      const req = httpMock.expectOne('/auth/login');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ username: 'alice', password: 'password123' });
      req.flush(mockAuthResponse);

      expect(result).toEqual(mockAuthResponse);
      expect(service.token()).toBe('jwt-token-value');
      expect(service.currentUser()).toEqual({ userId: 1, username: 'alice' });
      expect(service.isAuthenticated()).toBe(true);
      expect(JSON.parse(localStorage.getItem('auth')!)).toEqual({
        token: 'jwt-token-value',
        userId: 1,
        username: 'alice',
      });
    });
  });

  describe('register()', () => {
    it('persists the session to localStorage and updates signals on success', () => {
      const service = TestBed.inject(AuthService);
      let result: AuthResponse | undefined;

      service.register('alice', 'password123').subscribe((r) => (result = r));

      const req = httpMock.expectOne('/auth/register');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ username: 'alice', password: 'password123' });
      req.flush(mockAuthResponse);

      expect(result).toEqual(mockAuthResponse);
      expect(service.token()).toBe('jwt-token-value');
      expect(service.currentUser()).toEqual({ userId: 1, username: 'alice' });
      expect(JSON.parse(localStorage.getItem('auth')!)).toEqual({
        token: 'jwt-token-value',
        userId: 1,
        username: 'alice',
      });
    });
  });

  describe('logout()', () => {
    it('clears localStorage and both signals without making a server request', () => {
      localStorage.setItem(
        'auth',
        JSON.stringify({ token: 'stored-token', userId: 5, username: 'bob' }),
      );
      const service = TestBed.inject(AuthService);
      expect(service.isAuthenticated()).toBe(true);

      service.logout();

      expect(service.token()).toBeNull();
      expect(service.currentUser()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
      expect(localStorage.getItem('auth')).toBeNull();
      httpMock.expectNone(() => true);
    });

    it('clears favorites and recently-viewed stores', () => {
      const service = TestBed.inject(AuthService);
      const favoritesService = TestBed.inject(FavoritesService);
      const recentlyViewedService = TestBed.inject(RecentlyViewedService);

      favoritesService.toggle(42);
      recentlyViewedService.record(42);
      expect(favoritesService.favoriteIds().size).toBe(1);
      expect(recentlyViewedService.recentIds().length).toBe(1);

      service.logout();

      expect(favoritesService.favoriteIds().size).toBe(0);
      expect(recentlyViewedService.recentIds().length).toBe(0);
      expect(JSON.parse(localStorage.getItem('recipeFavorites')!)).toEqual([]);
      expect(JSON.parse(localStorage.getItem('recipeRecentlyViewed')!)).toEqual([]);
    });
  });
});
