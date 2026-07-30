import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecentlyViewedService } from './recently-viewed.service';

describe('RecentlyViewedService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe('construction / initial state', () => {
    it('seeds recentIds from a pre-populated localStorage value', () => {
      localStorage.setItem('recipeRecentlyViewed', JSON.stringify([3, 2, 1]));

      const service = TestBed.inject(RecentlyViewedService);

      expect(service.recentIds()).toEqual([3, 2, 1]);
    });

    it('falls back to [] when localStorage has no stored value', () => {
      const service = TestBed.inject(RecentlyViewedService);

      expect(service.recentIds()).toEqual([]);
    });

    it('falls back to [] without throwing when the stored value is invalid JSON', () => {
      localStorage.setItem('recipeRecentlyViewed', 'not valid json{');

      expect(() => TestBed.inject(RecentlyViewedService)).not.toThrow();
      const service = TestBed.inject(RecentlyViewedService);
      expect(service.recentIds()).toEqual([]);
    });

    it('falls back to [] without throwing when the stored value has the wrong shape', () => {
      localStorage.setItem('recipeRecentlyViewed', JSON.stringify({ not: 'an array' }));

      const service = TestBed.inject(RecentlyViewedService);

      expect(service.recentIds()).toEqual([]);
    });

    it('falls back to [] without throwing when the stored array contains non-numbers', () => {
      localStorage.setItem('recipeRecentlyViewed', JSON.stringify([1, 'two', 3]));

      const service = TestBed.inject(RecentlyViewedService);

      expect(service.recentIds()).toEqual([]);
    });
  });

  describe('record()', () => {
    it('unshifts a new id to the front and writes through to localStorage', () => {
      localStorage.setItem('recipeRecentlyViewed', JSON.stringify([2, 1]));
      const service = TestBed.inject(RecentlyViewedService);

      service.record(3);

      expect(service.recentIds()).toEqual([3, 2, 1]);
      expect(JSON.parse(localStorage.getItem('recipeRecentlyViewed')!)).toEqual([3, 2, 1]);
    });

    it('moves an already-present id to the front without duplicating it', () => {
      localStorage.setItem('recipeRecentlyViewed', JSON.stringify([3, 2, 1]));
      const service = TestBed.inject(RecentlyViewedService);

      service.record(1);

      expect(service.recentIds()).toEqual([1, 3, 2]);
    });

    it('drops the oldest id once RECENT_LIMIT (10) is exceeded', () => {
      localStorage.setItem('recipeRecentlyViewed', JSON.stringify([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]));
      const service = TestBed.inject(RecentlyViewedService);

      service.record(11);

      expect(service.recentIds()).toEqual([11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
      expect(service.recentIds()).not.toContain(1);
      expect(service.recentIds().length).toBe(10);
    });
  });

  describe('remove()', () => {
    it('drops one specific id, leaving the rest untouched', () => {
      localStorage.setItem('recipeRecentlyViewed', JSON.stringify([3, 2, 1]));
      const service = TestBed.inject(RecentlyViewedService);

      service.remove(2);

      expect(service.recentIds()).toEqual([3, 1]);
      expect(JSON.parse(localStorage.getItem('recipeRecentlyViewed')!)).toEqual([3, 1]);
    });
  });

  describe('clear()', () => {
    it('empties the list and writes through to localStorage', () => {
      localStorage.setItem('recipeRecentlyViewed', JSON.stringify([3, 2, 1]));
      const service = TestBed.inject(RecentlyViewedService);

      service.clear();

      expect(service.recentIds()).toEqual([]);
      expect(JSON.parse(localStorage.getItem('recipeRecentlyViewed')!)).toEqual([]);
    });
  });
});
