import { Injectable, signal } from '@angular/core';

export type ThemeName = 'cucumber' | 'mango';
export type ThemeMode = 'light' | 'dark';

export interface Theme {
  name: ThemeName;
  mode: ThemeMode;
}

const STORAGE_KEY = 'selectedTheme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>({ name: 'cucumber', mode: 'light' });

  constructor() {
    this.loadTheme();
  }

  private loadTheme(): void {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed: Theme = JSON.parse(saved);
        if (
          (parsed.name === 'cucumber' || parsed.name === 'mango') &&
          (parsed.mode === 'light' || parsed.mode === 'dark')
        ) {
          this.theme.set(parsed);
          this.applyTheme(parsed);
          return;
        }
      } catch {
        // ignore invalid
      }
    }
    // fallback default
    this.applyTheme(this.theme());
  }

  /**
   * Sets the theme to the given name and mode, applies it immediately,
   * and persists to localStorage.
   */
  setTheme(name: ThemeName, mode: ThemeMode): void {
    const nextTheme: Theme = { name, mode };
    this.theme.set(nextTheme);
    this.applyTheme(nextTheme);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextTheme));
  }

  /** Applies the theme by adding/removing CSS classes on document.body */
  private applyTheme(theme: Theme): void {
    const { name, mode } = theme;
    const body = document.body;
    // Remove previous theme classes
    for (const themeName of ['cucumber', 'mango']) {
      for (const themeMode of ['light', 'dark']) {
        body.classList.remove(`${themeName}-${themeMode}`);
      }
    }
    // Add the current theme class
    body.classList.add(`${name}-${mode}`);
  }

  /** Toggles light/dark mode, keeping the same theme name */
  toggleMode(): void {
    const current = this.theme();
    const nextMode = current.mode === 'light' ? 'dark' : 'light';
    this.setTheme(current.name, nextMode);
  }
}
