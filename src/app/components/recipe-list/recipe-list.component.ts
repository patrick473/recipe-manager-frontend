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
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, skip } from 'rxjs/operators';
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

/**
 * Parses `field,dir` from the route's `sort` query param, falling back to the
 * localStorage-persisted preference when the param is absent or invalid.
 * `q`/`tags`/`page` are session/URL-only (never persisted), but `sort` keeps
 * its standing localStorage default and is only overridden when the URL
 * itself carries a `sort` param (e.g. a shared link or reload).
 */
function initialSort(route: ActivatedRoute): { key: SortKey; dir: SortDir } {
  const raw = route.snapshot.queryParamMap.get('sort');
  if (raw) {
    const [field, dir] = raw.split(',');
    if ((SORT_KEYS as string[]).includes(field)) {
      return { key: field as SortKey, dir: dir === 'desc' ? 'desc' : 'asc' };
    }
  }
  return { key: initialSortKey(), dir: initialSortDir() };
}

function initialSearchText(route: ActivatedRoute): string {
  return route.snapshot.queryParamMap.get('q') ?? '';
}

function initialActiveTags(route: ActivatedRoute): ReadonlySet<string> {
  const raw = route.snapshot.queryParamMap.get('tags');
  return new Set(raw ? raw.split(',').filter(Boolean) : []);
}

function initialPage(route: ActivatedRoute): number {
  const raw = Number(route.snapshot.queryParamMap.get('page'));
  return Number.isInteger(raw) && raw >= 0 ? raw : 0;
}

/**
 * Displays a card grid of all recipes. Each card links to the detail view.
 * Provides per-card delete (via a confirm dialog) with optimistic
 * removal from the list.
 *
 * Search, tag filtering, sorting, and pagination are all driven by the
 * server (`GET /recipes`) — this component holds only the current page's
 * `recipes()` plus the filter/sort/page state used to build the request.
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly recipes = signal<Recipe[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly deleting = signal<number | null>(null);
  protected readonly viewMode = signal<ViewMode>(initialViewMode());

  protected readonly searchText = signal(initialSearchText(this.route));
  protected readonly activeTags = signal<ReadonlySet<string>>(initialActiveTags(this.route));
  protected readonly sortKey = signal<SortKey>(initialSort(this.route).key);
  protected readonly sortDir = signal<SortDir>(initialSort(this.route).dir);
  protected readonly page = signal<number>(initialPage(this.route));
  protected readonly totalPages = signal(1);
  protected readonly totalElements = signal(0);

  /**
   * Distinct tags seen across every response fetched so far this session.
   * Never shrinks — the frontend no longer holds every recipe in memory, so
   * this is the union of tags on pages actually fetched, not "every tag in
   * the database". Tags that only exist on recipes not yet surfaced by a
   * search/page won't appear as a filter chip until they are (a known rough
   * edge, not a bug — see the spec for the deferred `/recipes/tags` fix).
   */
  protected readonly availableTags = signal<ReadonlySet<string>>(new Set());

  /** Whether a search term or tag filter is currently applied. */
  protected readonly isFilterActive = computed(
    () => this.searchText().trim().length > 0 || this.activeTags().size > 0,
  );

  constructor() {
    // The initial searchText value is already covered by ngOnInit's direct
    // loadRecipes() call, so skip toObservable's first (replayed) emission
    // and only debounce genuine subsequent keystrokes.
    toObservable(this.searchText)
      .pipe(skip(1), debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadRecipes());
  }

  ngOnInit(): void {
    this.loadRecipes();
  }

  private loadRecipes(): void {
    this.loading.set(true);
    this.error.set(null);

    const q = this.searchText().trim();
    const tags = [...this.activeTags()];
    const sort = `${this.sortKey()},${this.sortDir()}`;
    const page = this.page();

    this.syncQueryParams(q, tags, sort, page);

    this.recipeService
      .getAll({
        q: q || undefined,
        tags: tags.length > 0 ? tags : undefined,
        sort,
        page,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.recipes.set(response.content);
          this.totalPages.set(response.totalPages);
          this.totalElements.set(response.totalElements);
          this.availableTags.update((current) => {
            const next = new Set(current);
            for (const recipe of response.content) {
              for (const tag of recipe.tags ?? []) next.add(tag);
            }
            return next;
          });
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set('Failed to load recipes. Is the backend running?');
          this.loading.set(false);
          console.error(err);
        },
      });
  }

  /** Reflects the current filter/sort/page state into the route's query params without adding a history entry. */
  private syncQueryParams(q: string, tags: string[], sort: string, page: number): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: q || null,
        tags: tags.length > 0 ? tags.join(',') : null,
        sort,
        page: page || null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
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
    this.page.set(0);
    this.loadRecipes();
  }

  protected onSearchInput(event: Event): void {
    this.searchText.set((event.target as HTMLInputElement).value);
    this.page.set(0);
  }

  /** If `key` is already the active sort key, flips direction; otherwise switches to `key` at `asc`. */
  protected setSort(key: SortKey): void {
    if (this.sortKey() === key) {
      const nextDir: SortDir = this.sortDir() === 'asc' ? 'desc' : 'asc';
      this.sortDir.set(nextDir);
      localStorage.setItem(SORT_DIR_STORAGE_KEY, nextDir);
    } else {
      this.sortKey.set(key);
      this.sortDir.set('asc');
      localStorage.setItem(SORT_KEY_STORAGE_KEY, key);
      localStorage.setItem(SORT_DIR_STORAGE_KEY, 'asc');
    }

    this.page.set(0);
    this.loadRecipes();
  }

  protected onSortKeyChange(event: Event): void {
    this.setSort((event.target as HTMLSelectElement).value as SortKey);
  }

  protected prevPage(): void {
    if (this.page() <= 0) return;
    this.page.update((p) => p - 1);
    this.loadRecipes();
  }

  protected nextPage(): void {
    if (this.page() + 1 >= this.totalPages()) return;
    this.page.update((p) => p + 1);
    this.loadRecipes();
  }

  protected clearFilters(): void {
    this.searchText.set('');
    this.activeTags.set(new Set());
    this.page.set(0);
    this.loadRecipes();
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
