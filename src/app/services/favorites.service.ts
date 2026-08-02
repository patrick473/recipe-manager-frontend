import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'recipeFavorites';

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  readonly favoriteIds = signal<ReadonlySet<number>>(this.readStorage());

  isFavorite(id: number): boolean {
    return this.favoriteIds().has(id);
  }

  toggle(id: number): void {
    const next = new Set(this.favoriteIds());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.favoriteIds.set(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  }

  remove(id: number): void {
    const next = new Set(this.favoriteIds());
    next.delete(id);
    this.favoriteIds.set(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  }

  clear(): void {
    this.favoriteIds.set(new Set());
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
  }

  private readStorage(): ReadonlySet<number> {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return new Set();
    try {
      const parsed: unknown = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'number')) {
        return new Set(parsed);
      }
      return new Set();
    } catch {
      return new Set();
    }
  }
}
