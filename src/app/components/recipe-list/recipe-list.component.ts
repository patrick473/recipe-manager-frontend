import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Recipe } from '../../models/recipe.model';
import { RecipeService } from '../../services/recipe.service';
import { ButtonDirective } from '../../shared/button.directive';
import { IconComponent } from '../../shared/icon/icon.component';
import { LoaderComponent } from '../../shared/loader/loader.component';
import { totalTimeMinutes } from '../../shared/recipe-time.util';

type ViewMode = 'grid' | 'list';

const VIEW_MODE_STORAGE_KEY = 'recipeListViewMode';

function initialViewMode(): ViewMode {
  const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
  return stored === 'list' ? 'list' : 'grid';
}

type SortKey = 'title' | 'prepTimeMinutes' | 'cookTimeMinutes' | 'createdAt' | 'updatedAt';
type SortDir = 'asc' | 'desc';

const SORT_KEYS: readonly SortKey[] = [
  'title',
  'prepTimeMinutes',
  'cookTimeMinutes',
  'createdAt',
  'updatedAt',
];
const SORT_KEY_STORAGE_KEY = 'recipeListSortKey';
const SORT_DIR_STORAGE_KEY = 'recipeListSortDir';

function initialSortKey(): SortKey {
  const stored = localStorage.getItem(SORT_KEY_STORAGE_KEY);
  return (SORT_KEYS as string[]).includes(stored ?? '') ? (stored as SortKey) : 'title';
}

function initialSortDir(): SortDir {
  const stored = localStorage.getItem(SORT_DIR_STORAGE_KEY);
  return stored === 'desc' ? 'desc' : 'asc';
}

/** Extracts the value a recipe is compared on for a given sort key. `null` sorts last. */
function sortValue(recipe: Recipe, key: SortKey): string | number | null {
  switch (key) {
    case 'title':
      return recipe.title.toLowerCase();
    case 'prepTimeMinutes':
      return recipe.prepTimeMinutes ?? null;
    case 'cookTimeMinutes':
      return recipe.cookTimeMinutes ?? null;
    case 'createdAt':
      return recipe.createdAt;
    case 'updatedAt':
      return recipe.updatedAt;
  }
}

/** Nulls always sort last, regardless of direction. */
function compareRecipes(a: Recipe, b: Recipe, key: SortKey, dir: SortDir): number {
  const valueA = sortValue(a, key);
  const valueB = sortValue(b, key);

  if (valueA === null && valueB === null) return 0;
  if (valueA === null) return 1;
  if (valueB === null) return -1;

  const cmp =
    typeof valueA === 'string' && typeof valueB === 'string'
      ? valueA.localeCompare(valueB)
      : (valueA as number) - (valueB as number);

  return dir === 'asc' ? cmp : -cmp;
}

/**
 * Displays a card grid of all recipes. Each card links to the detail view.
 * Provides per-card delete (via a confirm dialog) with optimistic
 * removal from the list.
 *
 * Uses Angular 22 block control-flow (@if / @for / @empty).
 */
@Component({
  selector: 'app-recipe-list',
  imports: [RouterLink, DatePipe, ButtonDirective, IconComponent, LoaderComponent],
  templateUrl: './recipe-list.component.html',
  styleUrl: './recipe-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeListComponent implements OnInit {
  private readonly recipeService = inject(RecipeService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly recipes = signal<Recipe[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly deleting = signal<number | null>(null);
  protected readonly viewMode = signal<ViewMode>(initialViewMode());

  protected readonly searchText = signal('');
  protected readonly activeTags = signal<ReadonlySet<string>>(new Set());
  protected readonly sortKey = signal<SortKey>(initialSortKey());
  protected readonly sortDir = signal<SortDir>(initialSortDir());

  /** Distinct tags across all loaded recipes, sorted alphabetically. */
  protected readonly availableTags = computed(() =>
    [...new Set(this.recipes().flatMap((r) => r.tags ?? []))].sort(),
  );

  /**
   * `recipes()` filtered by search text (title/description substring, case
   * insensitive) AND-ed with tag selection (OR-semantics among selected tags).
   */
  protected readonly filteredRecipes = computed(() => {
    const search = this.searchText().trim().toLowerCase();
    const tags = this.activeTags();

    return this.recipes().filter((recipe) => {
      const matchesSearch =
        !search ||
        recipe.title.toLowerCase().includes(search) ||
        (recipe.description ?? '').toLowerCase().includes(search);
      const matchesTags = tags.size === 0 || (recipe.tags ?? []).some((tag) => tags.has(tag));
      return matchesSearch && matchesTags;
    });
  });

  /** `filteredRecipes()` sorted by the current sort key/direction; nulls sort last. */
  protected readonly sortedRecipes = computed(() => {
    const key = this.sortKey();
    const dir = this.sortDir();
    return [...this.filteredRecipes()].sort((a, b) => compareRecipes(a, b, key, dir));
  });

  ngOnInit(): void {
    this.loadRecipes();
  }

  private loadRecipes(): void {
    this.loading.set(true);
    this.error.set(null);
    this.recipeService
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.recipes.set(data);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set('Failed to load recipes. Is the backend running?');
          this.loading.set(false);
          console.error(err);
        },
      });
  }

  protected readonly totalTimeMinutes = totalTimeMinutes;

  protected setViewMode(mode: ViewMode): void {
    this.viewMode.set(mode);
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  }

  protected toggleTag(tag: string): void {
    this.activeTags.update((current) => {
      const next = new Set(current);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  }

  protected onSearchInput(event: Event): void {
    this.searchText.set((event.target as HTMLInputElement).value);
  }

  /** If `key` is already the active sort key, flips direction; otherwise switches to `key` at `asc`. */
  protected setSort(key: SortKey): void {
    if (this.sortKey() === key) {
      const nextDir: SortDir = this.sortDir() === 'asc' ? 'desc' : 'asc';
      this.sortDir.set(nextDir);
      localStorage.setItem(SORT_DIR_STORAGE_KEY, nextDir);
      return;
    }

    this.sortKey.set(key);
    this.sortDir.set('asc');
    localStorage.setItem(SORT_KEY_STORAGE_KEY, key);
    localStorage.setItem(SORT_DIR_STORAGE_KEY, 'asc');
  }

  protected onSortKeyChange(event: Event): void {
    this.setSort((event.target as HTMLSelectElement).value as SortKey);
  }

  protected clearFilters(): void {
    this.searchText.set('');
    this.activeTags.set(new Set());
  }

  protected deleteRecipe(recipe: Recipe): void {
    this.recipeService
      .deleteWithConfirm(recipe, () => this.deleting.set(recipe.id))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (deleted) => {
          this.deleting.set(null);
          if (deleted) {
            this.recipes.update((recipes) => recipes.filter((r) => r.id !== recipe.id));
          }
        },
        error: (err) => {
          this.error.set(`Failed to delete "${recipe.title}".`);
          this.deleting.set(null);
          console.error(err);
        },
      });
  }
}
