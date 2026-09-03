import { Injectable, signal } from '@angular/core';

export type ThemeName = 'cucumber' | 'mango';

const THEME_STORAGE_KEY = 'app_theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _theme = signal<ThemeName>('cucumber');

  readonly theme = this._theme.asReadonly();

  constructor() {
    // Initialize theme from localStorage or prefers-color-scheme
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeName | null;
    if (saved === 'cucumber' || saved === 'mango') {
      this._theme.set(saved);
    } else {
      // Detect from system preference
      const prefersMango = window.matchMedia('(prefers-color-scheme: mango)').matches;
      // Using mango as custom theme, fall back to cucumber
      if (prefersMango) {
        this._theme.set('mango');
      } else {
        this._theme.set('cucumber');
      }
    }
    this.applyTheme(this._theme());
    this._theme.subscribe((theme) => {
      this.applyTheme(theme);
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    });
  }

  toggle() {
    const next = this._theme() === 'cucumber' ? 'mango' : 'cucumber';
    this._theme.set(next);
  }

  set(theme: ThemeName) {
    if (theme === 'cucumber' || theme === 'mango') {
      this._theme.set(theme);
    }
  }

  private applyTheme(theme: ThemeName) {
    const htmlEl = document.documentElement;
    htmlEl.classList.remove('theme-cucumber', 'theme-mango');
    htmlEl.classList.add(`theme-${theme}`);
  }
}
