import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FavoritesService } from './favorites.service';

describe('FavoritesService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe('construction / initial state', () => {
    it('seeds favoriteIds from a pre-populated localStorage value', () => {
      localStorage.setItem('recipeFavorites', JSON.stringify([1, 2, 3]));

      const service = TestBed.inject(FavoritesService);

      expect(service.favoriteIds()).toEqual(new Set([1, 2, 3]));
    });

    it('falls back to an empty set when localStorage has no stored value', () => {
      const service = TestBed.inject(FavoritesService);

      expect(service.favoriteIds()).toEqual(new Set());
    });

    it('falls back to an empty set without throwing when the stored value is invalid JSON', () => {
      localStorage.setItem('recipeFavorites', 'not valid json{');

      expect(() => TestBed.inject(FavoritesService)).not.toThrow();
      const service = TestBed.inject(FavoritesService);
      expect(service.favoriteIds()).toEqual(new Set());
    });

    it('falls back to an empty set without throwing when the stored value has the wrong shape', () => {
      localStorage.setItem('recipeFavorites', JSON.stringify({ not: 'an array' }));

      const service = TestBed.inject(FavoritesService);

      expect(service.favoriteIds()).toEqual(new Set());
    });

    it('falls back to an empty set without throwing when the stored array contains non-numbers', () => {
      localStorage.setItem('recipeFavorites', JSON.stringify([1, 'two', 3]));

      const service = TestBed.inject(FavoritesService);

      expect(service.favoriteIds()).toEqual(new Set());
    });
  });

  describe('isFavorite()', () => {
    it('reflects the current favorited state', () => {
      const service = TestBed.inject(FavoritesService);

      expect(service.isFavorite(5)).toBe(false);

      service.toggle(5);
      expect(service.isFavorite(5)).toBe(true);

      service.toggle(5);
      expect(service.isFavorite(5)).toBe(false);
    });
  });

  describe('toggle()', () => {
    it('adds an id to the set and writes through to localStorage', () => {
      const service = TestBed.inject(FavoritesService);

      service.toggle(7);

      expect(service.favoriteIds()).toEqual(new Set([7]));
      expect(JSON.parse(localStorage.getItem('recipeFavorites')!)).toEqual([7]);
    });

    it('removes an already-favorited id from the set and writes through to localStorage', () => {
      localStorage.setItem('recipeFavorites', JSON.stringify([7, 8]));
      const service = TestBed.inject(FavoritesService);

      service.toggle(7);

      expect(service.favoriteIds()).toEqual(new Set([8]));
      expect(JSON.parse(localStorage.getItem('recipeFavorites')!)).toEqual([8]);
    });
  });
});
