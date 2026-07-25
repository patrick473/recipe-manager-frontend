import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'theme';

function initialDarkMode(): boolean {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark') return true;
  if (stored === 'light') return false;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly darkMode = signal(initialDarkMode());

  constructor() {
    this.apply(this.darkMode());
  }

  toggle(): void {
    this.set(!this.darkMode());
  }

  set(darkMode: boolean): void {
    this.darkMode.set(darkMode);
    localStorage.setItem(STORAGE_KEY, darkMode ? 'dark' : 'light');
    this.apply(darkMode);
  }

  private apply(darkMode: boolean): void {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }
}
