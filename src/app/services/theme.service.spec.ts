import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeService } from './theme.service';

function mockMatchMedia(matches: boolean): void {
  // jsdom doesn't implement matchMedia at all, so there's nothing to spy on —
  // stub it directly instead.
  window.matchMedia = vi.fn().mockReturnValue({ matches } as MediaQueryList);
}

describe('ThemeService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, 'matchMedia');
    document.documentElement.removeAttribute('data-theme');
  });

  describe('initial dark mode resolution', () => {
    it("uses dark mode when localStorage['theme'] is 'dark', regardless of matchMedia", () => {
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('dark');
      mockMatchMedia(false);

      const service = TestBed.inject(ThemeService);

      expect(service.darkMode()).toBe(true);
    });

    it("uses light mode when localStorage['theme'] is 'light', regardless of matchMedia", () => {
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('light');
      mockMatchMedia(true);

      const service = TestBed.inject(ThemeService);

      expect(service.darkMode()).toBe(false);
    });

    it('falls back to matchMedia when localStorage has no stored theme and prefers dark', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
      mockMatchMedia(true);

      const service = TestBed.inject(ThemeService);

      expect(service.darkMode()).toBe(true);
    });

    it('falls back to matchMedia when localStorage has no stored theme and prefers light', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
      mockMatchMedia(false);

      const service = TestBed.inject(ThemeService);

      expect(service.darkMode()).toBe(false);
    });

    it('defaults to light mode when localStorage has no stored theme and matchMedia is unsupported', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);

      const service = TestBed.inject(ThemeService);

      expect(service.darkMode()).toBe(false);
    });
  });

  describe('toggle()', () => {
    it('flips darkMode() and persists the new value to localStorage', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('light');
      mockMatchMedia(false);
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

      const service = TestBed.inject(ThemeService);
      expect(service.darkMode()).toBe(false);

      service.toggle();
      expect(service.darkMode()).toBe(true);
      expect(setItemSpy).toHaveBeenCalledWith('theme', 'dark');

      service.toggle();
      expect(service.darkMode()).toBe(false);
      expect(setItemSpy).toHaveBeenCalledWith('theme', 'light');
    });
  });

  describe('set()', () => {
    it('updates the data-theme attribute on document.documentElement', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
      mockMatchMedia(false);

      const service = TestBed.inject(ThemeService);

      service.set(true);
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

      service.set(false);
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });
  });
});
