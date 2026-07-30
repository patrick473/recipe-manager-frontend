import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'recipeRecentlyViewed';
const RECENT_LIMIT = 10;

@Injectable({ providedIn: 'root' })
export class RecentlyViewedService {
  readonly recentIds = signal<readonly number[]>(this.readStorage());

  record(id: number): void {
    const next = [id, ...this.recentIds().filter((x) => x !== id)].slice(0, RECENT_LIMIT);
    this.write(next);
  }

  remove(id: number): void {
    const next = this.recentIds().filter((x) => x !== id);
    this.write(next);
  }

  clear(): void {
    this.write([]);
  }

  private write(next: readonly number[]): void {
    this.recentIds.set(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  private readStorage(): readonly number[] {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    try {
      const parsed: unknown = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'number')) {
        return parsed;
      }
      return [];
    } catch {
      return [];
    }
  }
}
