import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Recipe, RecipePageResponse } from '../../models/recipe.model';
import { FavoritesService } from '../../services/favorites.service';
import { RecentlyViewedService } from '../../services/recently-viewed.service';
import { RecipeService } from '../../services/recipe.service';
import { RecipeListComponent } from './recipe-list.component';

const mockRecipes: Recipe[] = [
  {
    id: 1,
    title: 'Pasta Carbonara',
    description: 'Classic Italian pasta',
    content: '## Ingredients\n- Pasta\n- Eggs',
    ingredients: [], steps: [],
    createdAt: '2024-01-01T10:00:00',
    updatedAt: '2024-01-01T10:00:00',
  },
  {
    id: 2,
    title: 'Banana Bread',
    description: null,
    content: '## Ingredients\n- Bananas\n- Flour',
    ingredients: [], steps: [],
    createdAt: '2024-01-02T10:00:00',
    updatedAt: '2024-01-02T10:00:00',
  },
];

const taggedRecipes: Recipe[] = [
  {
    id: 1,
    title: 'Pancakes',
    description: 'Fluffy breakfast stack',
    content: '## Ingredients\n- Flour',
    ingredients: [], steps: [],
    tags: ['breakfast', 'sweet'],
    createdAt: '2024-01-01T10:00:00',
    updatedAt: '2024-01-01T10:00:00',
  },
  {
    id: 2,
    title: 'Omelette',
    description: 'Quick breakfast eggs',
    content: '## Ingredients\n- Eggs',
    ingredients: [], steps: [],
    tags: ['breakfast', 'quick'],
    createdAt: '2024-01-02T10:00:00',
    updatedAt: '2024-01-02T10:00:00',
  },
  {
    id: 3,
    title: 'Steak',
    description: 'Hearty dinner main',
    content: '## Ingredients\n- Steak',
    ingredients: [], steps: [],
    tags: ['dinner'],
    createdAt: '2024-01-03T10:00:00',
    updatedAt: '2024-01-03T10:00:00',
  },
];

/** Builds a `RecipePageResponse` envelope around `content`, with sane single-page defaults. */
function toPage(
  content: Recipe[],
  overrides: Partial<RecipePageResponse> = {},
): RecipePageResponse {
  return {
    content,
    page: 0,
    size: 20,
    totalElements: content.length,
    totalPages: 1,
    ...overrides,
  };
}

/** A fake ActivatedRoute exposing only the query-param snapshot the component reads on init. */
function routeWithQueryParams(params: Record<string, string>): ActivatedRoute {
  return { snapshot: { queryParamMap: convertToParamMap(params) } } as ActivatedRoute;
}

describe('RecipeListComponent', () => {
  let fakeRecipeService: {
    getAll: ReturnType<typeof vi.fn>;
    deleteWithConfirm: ReturnType<typeof vi.fn>;
    getById: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    localStorage.clear();

    fakeRecipeService = {
      getAll: vi.fn(),
      deleteWithConfirm: vi.fn(),
      // Default: resolve any id to a minimal placeholder recipe, so the
      // favorites/recently-viewed strip pipelines (which call getById for
      // every stored id) don't blow up in tests that never touch those
      // stores. Tests exercising the strips override this per-case.
      getById: vi.fn((id: number) =>
        of({
          id,
          title: `Recipe ${id}`,
          description: null,
          content: '',
          createdAt: '2024-01-01T10:00:00',
          updatedAt: '2024-01-01T10:00:00',
        } as Recipe),
      ),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: RecipeService, useValue: fakeRecipeService },
        // RecipeListComponent's template uses [routerLink] on each card, which
        // needs a Router/ActivatedRoute in the injector to construct — an empty
        // route config is enough, we don't exercise navigation in these tests.
        provideRouter([]),
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads recipes into recipes() and flips loading() to false on init', () => {
    fakeRecipeService.getAll.mockReturnValue(of(toPage(mockRecipes)));

    const fixture = TestBed.createComponent(RecipeListComponent);
    const component = fixture.componentInstance;

    fixture.detectChanges();

    expect(component['recipes']()).toEqual(mockRecipes);
    expect(component['loading']()).toBe(false);
  });

  it('requests the default q/tags/sort/page on first load', () => {
    fakeRecipeService.getAll.mockReturnValue(of(toPage(mockRecipes)));

    const fixture = TestBed.createComponent(RecipeListComponent);
    fixture.detectChanges();

    expect(fakeRecipeService.getAll).toHaveBeenCalledWith({
      q: undefined,
      tags: undefined,
      sort: 'title,asc',
      page: 0,
    });
  });

  it('sets error() and loading(false) when loading recipes fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fakeRecipeService.getAll.mockReturnValue(throwError(() => new Error('boom')));

    const fixture = TestBed.createComponent(RecipeListComponent);
    const component = fixture.componentInstance;

    fixture.detectChanges();

    expect(component['error']()).toBe('Failed to load recipes. Is the backend running?');
    expect(component['loading']()).toBe(false);
  });

  it('removes the recipe from recipes() when the delete is confirmed', () => {
    fakeRecipeService.getAll.mockReturnValue(of(toPage(mockRecipes)));
    const delete$ = new Subject<boolean>();
    fakeRecipeService.deleteWithConfirm.mockImplementation(
      (recipe: Recipe, onConfirmed?: () => void) => {
        onConfirmed?.();
        return delete$.asObservable();
      },
    );

    const fixture = TestBed.createComponent(RecipeListComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component['deleteRecipe'](mockRecipes[0]);
    delete$.next(true);
    delete$.complete();

    expect(component['recipes']()).toEqual([mockRecipes[1]]);
  });

  it('removes the recipe from favorites and recently-viewed stores when the delete is confirmed', () => {
    fakeRecipeService.getAll.mockReturnValue(of(toPage(mockRecipes)));
    const delete$ = new Subject<boolean>();
    fakeRecipeService.deleteWithConfirm.mockImplementation(
      (recipe: Recipe, onConfirmed?: () => void) => {
        onConfirmed?.();
        return delete$.asObservable();
      },
    );

    const fixture = TestBed.createComponent(RecipeListComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const favoritesService = TestBed.inject(FavoritesService);
    const recentlyViewedService = TestBed.inject(RecentlyViewedService);
    const favoritesRemoveSpy = vi.spyOn(favoritesService, 'remove');
    const recentlyViewedRemoveSpy = vi.spyOn(recentlyViewedService, 'remove');

    component['deleteRecipe'](mockRecipes[0]);
    delete$.next(true);
    delete$.complete();

    expect(favoritesRemoveSpy).toHaveBeenCalledWith(mockRecipes[0].id);
    expect(recentlyViewedRemoveSpy).toHaveBeenCalledWith(mockRecipes[0].id);
  });

  it('does not touch favorites/recently-viewed stores when the delete is cancelled', () => {
    fakeRecipeService.getAll.mockReturnValue(of(toPage(mockRecipes)));
    const delete$ = new Subject<boolean>();
    fakeRecipeService.deleteWithConfirm.mockReturnValue(delete$.asObservable());

    const fixture = TestBed.createComponent(RecipeListComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const favoritesService = TestBed.inject(FavoritesService);
    const recentlyViewedService = TestBed.inject(RecentlyViewedService);
    const favoritesRemoveSpy = vi.spyOn(favoritesService, 'remove');
    const recentlyViewedRemoveSpy = vi.spyOn(recentlyViewedService, 'remove');

    component['deleteRecipe'](mockRecipes[0]);
    delete$.next(false);
    delete$.complete();

    expect(favoritesRemoveSpy).not.toHaveBeenCalled();
    expect(recentlyViewedRemoveSpy).not.toHaveBeenCalled();
  });

  it('leaves recipes() unchanged when the delete is cancelled', () => {
    fakeRecipeService.getAll.mockReturnValue(of(toPage(mockRecipes)));
    const delete$ = new Subject<boolean>();
    fakeRecipeService.deleteWithConfirm.mockReturnValue(delete$.asObservable());

    const fixture = TestBed.createComponent(RecipeListComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component['deleteRecipe'](mockRecipes[0]);
    delete$.next(false);
    delete$.complete();

    expect(component['recipes']()).toEqual(mockRecipes);
  });

  it('sets deleting() to the recipe id while the delete is in flight', () => {
    fakeRecipeService.getAll.mockReturnValue(of(toPage(mockRecipes)));
    const delete$ = new Subject<boolean>();
    fakeRecipeService.deleteWithConfirm.mockImplementation(
      (recipe: Recipe, onConfirmed?: () => void) => {
        onConfirmed?.();
        return delete$.asObservable();
      },
    );

    const fixture = TestBed.createComponent(RecipeListComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component['deleteRecipe'](mockRecipes[0]);

    expect(component['deleting']()).toBe(mockRecipes[0].id);

    delete$.next(true);
    delete$.complete();

    expect(component['deleting']()).toBe(null);
  });

  it('sets error() with the recipe title and clears deleting() on delete failure', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fakeRecipeService.getAll.mockReturnValue(of(toPage(mockRecipes)));
    const delete$ = new Subject<boolean>();
    fakeRecipeService.deleteWithConfirm.mockImplementation(
      (recipe: Recipe, onConfirmed?: () => void) => {
        onConfirmed?.();
        return delete$.asObservable();
      },
    );

    const fixture = TestBed.createComponent(RecipeListComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component['deleteRecipe'](mockRecipes[0]);
    delete$.error(new Error('boom'));

    expect(component['error']()).toBe(`Failed to delete "${mockRecipes[0].title}".`);
    expect(component['deleting']()).toBe(null);
  });

  describe('view modes', () => {
    function createFixtureInMode(mode: 'grid' | 'list') {
      localStorage.setItem('recipeListViewMode', mode);
      // Edit/Delete are only rendered for an authenticated caller (see
      // AUTHENTICATION_SPEC.md's public-read revision) — seed a session the
      // same way the real AuthService persists one, so this DOM-wiring suite
      // exercises those controls rather than their auth-gated absence.
      localStorage.setItem(
        'auth',
        JSON.stringify({ token: 'fake-token', userId: 1, username: 'testuser' }),
      );
      fakeRecipeService.getAll.mockReturnValue(of(toPage(mockRecipes)));
      const fixture = TestBed.createComponent(RecipeListComponent);
      fixture.detectChanges();
      return fixture;
    }

    function findDeleteButton(element: HTMLElement): HTMLButtonElement {
      const button = Array.from(element.querySelectorAll('button')).find(
        (btn) => btn.textContent?.includes('Delete') && !btn.textContent.includes('Deleting'),
      );
      if (!button) {
        throw new Error('Delete button not found');
      }
      return button as HTMLButtonElement;
    }

    function findEditLink(element: HTMLElement): HTMLAnchorElement {
      const link = Array.from(element.querySelectorAll('a')).find((a) =>
        a.textContent?.includes('Edit'),
      );
      if (!link) {
        throw new Error('Edit link not found');
      }
      return link as HTMLAnchorElement;
    }

    function findFavoriteButton(element: HTMLElement): HTMLButtonElement {
      const button = element.querySelector(
        'button[aria-label="Add to favorites"], button[aria-label="Remove from favorites"]',
      );
      if (!button) {
        throw new Error('Favorite button not found');
      }
      return button as HTMLButtonElement;
    }

    it('defaults to grid mode when localStorage has no stored preference', () => {
      fakeRecipeService.getAll.mockReturnValue(of(toPage(mockRecipes)));

      const fixture = TestBed.createComponent(RecipeListComponent);
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelector('.recipe-grid')).toBeTruthy();
      expect(element.querySelector('.recipe-list')).toBeNull();
    });

    it('switches to list markup on toggle click and persists the choice to localStorage, surviving a fresh component instance', () => {
      fakeRecipeService.getAll.mockReturnValue(of(toPage(mockRecipes)));

      const fixture = TestBed.createComponent(RecipeListComponent);
      fixture.detectChanges();

      const listToggle = fixture.nativeElement.querySelector(
        'button[aria-label="List view"]',
      ) as HTMLButtonElement;
      listToggle.click();
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelector('.recipe-list')).toBeTruthy();
      expect(element.querySelector('.recipe-grid')).toBeNull();
      expect(localStorage.getItem('recipeListViewMode')).toBe('list');

      const reloadedFixture = TestBed.createComponent(RecipeListComponent);
      reloadedFixture.detectChanges();

      expect(
        (reloadedFixture.nativeElement as HTMLElement).querySelector('.recipe-list'),
      ).toBeTruthy();
    });

    it('reflects viewMode() in aria-pressed on the toggle buttons, flipping after a click', () => {
      fakeRecipeService.getAll.mockReturnValue(of(toPage(mockRecipes)));

      const fixture = TestBed.createComponent(RecipeListComponent);
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      const gridToggle = element.querySelector(
        'button[aria-label="Grid view"]',
      ) as HTMLButtonElement;
      const listToggle = element.querySelector(
        'button[aria-label="List view"]',
      ) as HTMLButtonElement;

      expect(gridToggle.getAttribute('aria-pressed')).toBe('true');
      expect(listToggle.getAttribute('aria-pressed')).toBe('false');

      listToggle.click();
      fixture.detectChanges();

      expect(gridToggle.getAttribute('aria-pressed')).toBe('false');
      expect(listToggle.getAttribute('aria-pressed')).toBe('true');
    });

    describe.each(['grid', 'list'] as const)('delete/edit DOM wiring in %s mode', (mode) => {
      // recipes() renders in whatever order the (mocked) server response
      // returns — no client-side sort is applied anymore.
      const firstRecipe = mockRecipes[0];
      const secondRecipe = mockRecipes[1];

      it('clicking Delete calls through the service and removes the recipe from recipes()', () => {
        const delete$ = new Subject<boolean>();
        fakeRecipeService.deleteWithConfirm.mockImplementation(
          (recipe: Recipe, onConfirmed?: () => void) => {
            onConfirmed?.();
            return delete$.asObservable();
          },
        );

        const fixture = createFixtureInMode(mode);
        const component = fixture.componentInstance;

        findDeleteButton(fixture.nativeElement).click();
        delete$.next(true);
        delete$.complete();
        fixture.detectChanges();

        expect(fakeRecipeService.deleteWithConfirm).toHaveBeenCalledWith(
          firstRecipe,
          expect.any(Function),
        );
        expect(component['recipes']()).toEqual([secondRecipe]);
      });

      it('renders an Edit link pointing at the recipe edit route', () => {
        const fixture = createFixtureInMode(mode);

        const editLink = findEditLink(fixture.nativeElement);

        expect(editLink.getAttribute('href')).toBe(`/recipes/${firstRecipe.id}/edit`);
      });

      it('reflects FavoritesService state on the favorite button and updates it on click', () => {
        const fixture = createFixtureInMode(mode);
        const favoritesService = TestBed.inject(FavoritesService);

        const favoriteButton = findFavoriteButton(fixture.nativeElement);

        expect(favoritesService.isFavorite(firstRecipe.id)).toBe(false);
        expect(favoriteButton.getAttribute('aria-pressed')).toBe('false');
        expect(favoriteButton.getAttribute('aria-label')).toBe('Add to favorites');
        expect(favoriteButton.querySelector('.material-icons')?.textContent).toBe(
          'favorite_border',
        );

        favoriteButton.click();
        fixture.detectChanges();

        expect(favoritesService.isFavorite(firstRecipe.id)).toBe(true);
        expect(favoriteButton.getAttribute('aria-pressed')).toBe('true');
        expect(favoriteButton.getAttribute('aria-label')).toBe('Remove from favorites');
        expect(favoriteButton.querySelector('.material-icons')?.textContent).toBe('favorite');

        favoriteButton.click();
        fixture.detectChanges();

        expect(favoritesService.isFavorite(firstRecipe.id)).toBe(false);
        expect(favoriteButton.getAttribute('aria-pressed')).toBe('false');
      });

      it('hides Edit and Delete for an unauthenticated caller but keeps the favorite button', () => {
        localStorage.setItem('recipeListViewMode', mode);
        fakeRecipeService.getAll.mockReturnValue(of(toPage(mockRecipes)));
        const fixture = TestBed.createComponent(RecipeListComponent);
        fixture.detectChanges();

        const element = fixture.nativeElement as HTMLElement;
        expect(
          Array.from(element.querySelectorAll('a')).some((a) => a.textContent?.includes('Edit')),
        ).toBe(false);
        expect(
          Array.from(element.querySelectorAll('button')).some((btn) =>
            btn.textContent?.includes('Delete'),
          ),
        ).toBe(false);
        expect(() => findFavoriteButton(element)).not.toThrow();
      });
    });
  });

  describe('search debounce', () => {
    it('does not refetch immediately on a search keystroke, only after 300ms of quiet', async () => {
      vi.useFakeTimers();
      try {
        fakeRecipeService.getAll.mockReturnValue(of(toPage(taggedRecipes)));

        const fixture = TestBed.createComponent(RecipeListComponent);
        const component = fixture.componentInstance;
        fixture.detectChanges();

        fakeRecipeService.getAll.mockClear();

        component['searchText'].set('omelette');
        fixture.detectChanges();

        expect(fakeRecipeService.getAll).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(299);
        expect(fakeRecipeService.getAll).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1);
        expect(fakeRecipeService.getAll).toHaveBeenCalledTimes(1);
        expect(fakeRecipeService.getAll).toHaveBeenCalledWith(
          expect.objectContaining({ q: 'omelette' }),
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it('resets page() to 0 immediately (before the debounced refetch) when the search text changes', () => {
      fakeRecipeService.getAll.mockReturnValue(of(toPage(taggedRecipes, { totalPages: 3 })));

      const fixture = TestBed.createComponent(RecipeListComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      component['page'].set(2);
      component['onSearchInput']({ target: { value: 'omelette' } } as unknown as Event);

      expect(component['page']()).toBe(0);
    });
  });

  describe('immediate (non-debounced) refetches', () => {
    it('toggleTag calls getAll immediately without waiting for a debounce', () => {
      fakeRecipeService.getAll.mockReturnValue(of(toPage(taggedRecipes)));

      const fixture = TestBed.createComponent(RecipeListComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();
      fakeRecipeService.getAll.mockClear();

      component['toggleTag']('breakfast');

      expect(fakeRecipeService.getAll).toHaveBeenCalledTimes(1);
      expect(fakeRecipeService.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ tags: ['breakfast'] }),
      );
    });

    it('toggleTag a second time with the same tag removes it again', () => {
      fakeRecipeService.getAll.mockReturnValue(of(toPage(taggedRecipes)));

      const fixture = TestBed.createComponent(RecipeListComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      component['toggleTag']('breakfast');
      expect(component['activeTags']().has('breakfast')).toBe(true);

      component['toggleTag']('breakfast');

      expect(component['activeTags']().has('breakfast')).toBe(false);
      expect(fakeRecipeService.getAll).toHaveBeenLastCalledWith(
        expect.objectContaining({ tags: undefined }),
      );
    });

    it('setSort calls getAll immediately with the new sort param', () => {
      fakeRecipeService.getAll.mockReturnValue(of(toPage(mockRecipes)));

      const fixture = TestBed.createComponent(RecipeListComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();
      fakeRecipeService.getAll.mockClear();

      component['setSort']('createdAt');

      expect(fakeRecipeService.getAll).toHaveBeenCalledTimes(1);
      expect(fakeRecipeService.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ sort: 'createdAt,asc' }),
      );
    });

    it('setSort flips direction and persists to localStorage when called with the already-active key', () => {
      fakeRecipeService.getAll.mockReturnValue(of(toPage(mockRecipes)));

      const fixture = TestBed.createComponent(RecipeListComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      component['setSort']('title');

      expect(component['sortDir']()).toBe('desc');
      expect(localStorage.getItem('recipeListSortDir')).toBe('desc');
    });

    it('setSort flips direction back to asc on a third call with the same key', () => {
      fakeRecipeService.getAll.mockReturnValue(of(toPage(mockRecipes)));

      const fixture = TestBed.createComponent(RecipeListComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      component['setSort']('title');
      expect(component['sortDir']()).toBe('desc');

      component['setSort']('title');

      expect(component['sortDir']()).toBe('asc');
      expect(localStorage.getItem('recipeListSortDir')).toBe('asc');
    });

    it('changing the sort <select> switches sortKey() and refetches', () => {
      fakeRecipeService.getAll.mockReturnValue(of(toPage(mockRecipes)));

      const fixture = TestBed.createComponent(RecipeListComponent);
      const element = fixture.nativeElement as HTMLElement;
      fixture.detectChanges();
      fakeRecipeService.getAll.mockClear();

      const select = element.querySelector('.recipe-sort-select') as HTMLSelectElement;
      select.value = 'createdAt';
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(fixture.componentInstance['sortKey']()).toBe('createdAt');
      expect(fakeRecipeService.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ sort: 'createdAt,asc' }),
      );
    });

    it('toggleTag and setSort reset page() to 0 before refetching', () => {
      fakeRecipeService.getAll.mockReturnValue(of(toPage(taggedRecipes, { totalPages: 3 })));

      const fixture = TestBed.createComponent(RecipeListComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      component['page'].set(2);
      component['toggleTag']('breakfast');

      expect(component['page']()).toBe(0);

      component['page'].set(2);
      component['setSort']('createdAt');

      expect(component['page']()).toBe(0);
    });
  });

  describe('pagination', () => {
    it('renders "Page X of Y" and disables Prev on the first page', () => {
      fakeRecipeService.getAll.mockReturnValue(of(toPage(mockRecipes, { page: 0, totalPages: 3 })));

      const fixture = TestBed.createComponent(RecipeListComponent);
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      expect(element.textContent).toContain('Page 1 of 3');

      const buttons = Array.from(element.querySelectorAll('.recipe-list-pager button'));
      const prevButton = buttons.find((b) => b.textContent?.trim() === 'Prev') as HTMLButtonElement;
      const nextButton = buttons.find((b) => b.textContent?.trim() === 'Next') as HTMLButtonElement;

      expect(prevButton.disabled).toBe(true);
      expect(nextButton.disabled).toBe(false);
    });

    it('disables Next on the last page', () => {
      fakeRecipeService.getAll.mockReturnValue(of(toPage(mockRecipes, { page: 2, totalPages: 3 })));

      const fixture = TestBed.createComponent(RecipeListComponent);
      const component = fixture.componentInstance;
      component['page'].set(2);
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      const buttons = Array.from(element.querySelectorAll('.recipe-list-pager button'));
      const nextButton = buttons.find((b) => b.textContent?.trim() === 'Next') as HTMLButtonElement;

      expect(nextButton.disabled).toBe(true);
    });

    it('nextPage() increments page() and calls getAll with the new page, without resetting filters', () => {
      fakeRecipeService.getAll.mockReturnValue(
        of(toPage(taggedRecipes, { page: 0, totalPages: 3 })),
      );

      const fixture = TestBed.createComponent(RecipeListComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      component['toggleTag']('breakfast');
      fakeRecipeService.getAll.mockClear();

      component['nextPage']();

      expect(component['page']()).toBe(1);
      expect(fakeRecipeService.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, tags: ['breakfast'] }),
      );
    });

    it('prevPage() decrements page() and calls getAll with the new page', () => {
      fakeRecipeService.getAll.mockReturnValue(of(toPage(mockRecipes, { page: 1, totalPages: 3 })));

      const fixture = TestBed.createComponent(RecipeListComponent);
      const component = fixture.componentInstance;
      component['page'].set(1);
      fixture.detectChanges();
      fakeRecipeService.getAll.mockClear();

      component['prevPage']();

      expect(component['page']()).toBe(0);
      expect(fakeRecipeService.getAll).toHaveBeenCalledWith(expect.objectContaining({ page: 0 }));
    });

    it('prevPage() is a no-op at the first page', () => {
      fakeRecipeService.getAll.mockReturnValue(of(toPage(mockRecipes, { page: 0, totalPages: 3 })));

      const fixture = TestBed.createComponent(RecipeListComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();
      fakeRecipeService.getAll.mockClear();

      component['prevPage']();

      expect(component['page']()).toBe(0);
      expect(fakeRecipeService.getAll).not.toHaveBeenCalled();
    });

    it('nextPage() is a no-op at the last page', () => {
      fakeRecipeService.getAll.mockReturnValue(of(toPage(mockRecipes, { page: 2, totalPages: 3 })));

      const fixture = TestBed.createComponent(RecipeListComponent);
      const component = fixture.componentInstance;
      component['page'].set(2);
      fixture.detectChanges();
      fakeRecipeService.getAll.mockClear();

      component['nextPage']();

      expect(component['page']()).toBe(2);
      expect(fakeRecipeService.getAll).not.toHaveBeenCalled();
    });
  });

  describe('availableTags', () => {
    it('accumulates the union of tags across responses instead of resetting per request', () => {
      fakeRecipeService.getAll.mockReturnValueOnce(
        of(toPage([taggedRecipes[0]], { totalPages: 2 })),
      );

      const fixture = TestBed.createComponent(RecipeListComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      expect([...component['availableTags']()].sort()).toEqual(['breakfast', 'sweet']);

      fakeRecipeService.getAll.mockReturnValueOnce(
        of(toPage([taggedRecipes[2]], { page: 1, totalPages: 2 })),
      );
      component['nextPage']();

      // The tags from the first response ("breakfast", "sweet") are still
      // present even though the current page's content no longer includes
      // that recipe — availableTags is sticky for the session.
      expect([...component['availableTags']()].sort()).toEqual(['breakfast', 'dinner', 'sweet']);
    });

    it('does not render the tag-chip row when no recipe in any fetched response has tags', () => {
      fakeRecipeService.getAll.mockReturnValue(of(toPage(mockRecipes)));
      const fixture = TestBed.createComponent(RecipeListComponent);
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelector('.recipe-tag-filters')).toBeNull();
    });
  });

  describe('empty/error state', () => {
    it('shows "No recipes yet" when q/tags are empty and the page has no content', () => {
      fakeRecipeService.getAll.mockReturnValue(of(toPage([])));
      const fixture = TestBed.createComponent(RecipeListComponent);
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      expect(element.textContent).toContain('No recipes yet');
      expect(element.textContent).not.toContain('No recipes match your search.');
    });

    it('shows "No matches" + Clear filters when a filter is active and the page has no content', () => {
      fakeRecipeService.getAll.mockReturnValue(of(toPage(taggedRecipes)));
      const fixture = TestBed.createComponent(RecipeListComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      fakeRecipeService.getAll.mockReturnValue(of(toPage([])));
      component['toggleTag']('breakfast');
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      expect(element.textContent).toContain('No recipes match your search.');
      expect(element.textContent).not.toContain('No recipes yet');
    });

    it('does not show either empty state while the load errored', () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      fakeRecipeService.getAll.mockReturnValue(throwError(() => new Error('boom')));
      const fixture = TestBed.createComponent(RecipeListComponent);
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      expect(element.textContent).not.toContain('No recipes match your search.');
      expect(element.textContent).not.toContain('No recipes yet');
      expect(element.textContent).toContain('Failed to load recipes. Is the backend running?');
    });

    it('clearFilters resets searchText()/activeTags()/page() to defaults and refetches', () => {
      fakeRecipeService.getAll.mockReturnValue(of(toPage(taggedRecipes)));
      const fixture = TestBed.createComponent(RecipeListComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      component['searchText'].set('nothing matches this');
      component['toggleTag']('breakfast');
      component['page'].set(2);
      fakeRecipeService.getAll.mockClear();

      component['clearFilters']();

      expect(component['searchText']()).toBe('');
      expect(component['activeTags']().size).toBe(0);
      expect(component['page']()).toBe(0);
      expect(fakeRecipeService.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ q: undefined, tags: undefined, page: 0 }),
      );
    });

    it('clicking "Clear filters" in the "no matches" state restores the full list', () => {
      fakeRecipeService.getAll.mockReturnValue(of(toPage(taggedRecipes)));
      const fixture = TestBed.createComponent(RecipeListComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      fakeRecipeService.getAll.mockReturnValue(of(toPage([])));
      component['searchText'].set('nothing matches this');
      component['loadRecipes']();
      fixture.detectChanges();

      const clearButton = Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
      ).find((btn) => btn.textContent?.includes('Clear filters')) as HTMLButtonElement;
      expect(clearButton).toBeTruthy();

      fakeRecipeService.getAll.mockReturnValue(of(toPage(taggedRecipes)));
      clearButton.click();
      fixture.detectChanges();

      expect(component['searchText']()).toBe('');
      expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
        'No recipes match your search.',
      );
    });
  });

  describe('thumbnails', () => {
    it('renders an <img> with the resolved src for a recipe with an imageUrl (grid mode)', () => {
      const recipeWithImage: Recipe = { ...mockRecipes[0], imageUrl: '/recipes/1/image' };
      fakeRecipeService.getAll.mockReturnValue(of(toPage([recipeWithImage, mockRecipes[1]])));

      const fixture = TestBed.createComponent(RecipeListComponent);
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      const img = element.querySelector('.recipe-card-thumb') as HTMLImageElement;

      expect(img).toBeTruthy();
      expect(img.tagName).toBe('IMG');
      expect(img.getAttribute('src')).toBe('http://localhost:8080/recipes/1/image');
    });

    it('renders a placeholder icon (no <img>) for a recipe without an imageUrl (grid mode)', () => {
      fakeRecipeService.getAll.mockReturnValue(of(toPage(mockRecipes)));

      const fixture = TestBed.createComponent(RecipeListComponent);
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      const thumbs = element.querySelectorAll('.recipe-card-thumb');
      const placeholder = thumbs[0] as HTMLElement;

      expect(placeholder.tagName).not.toBe('IMG');
      expect(placeholder.classList.contains('image-placeholder')).toBe(true);
      expect(placeholder.querySelector('app-icon')).toBeTruthy();
    });

    it('renders an <img> with the resolved src for a recipe with an imageUrl (list mode)', () => {
      localStorage.setItem('recipeListViewMode', 'list');
      const recipeWithImage: Recipe = { ...mockRecipes[0], imageUrl: '/recipes/1/image' };
      fakeRecipeService.getAll.mockReturnValue(of(toPage([recipeWithImage, mockRecipes[1]])));

      const fixture = TestBed.createComponent(RecipeListComponent);
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      const img = element.querySelector('.recipe-list-row-thumb') as HTMLImageElement;

      expect(img).toBeTruthy();
      expect(img.tagName).toBe('IMG');
      expect(img.getAttribute('src')).toBe('http://localhost:8080/recipes/1/image');
    });

    it('renders a placeholder icon (no <img>) for a recipe without an imageUrl (list mode)', () => {
      localStorage.setItem('recipeListViewMode', 'list');
      fakeRecipeService.getAll.mockReturnValue(of(toPage(mockRecipes)));

      const fixture = TestBed.createComponent(RecipeListComponent);
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      const thumbs = element.querySelectorAll('.recipe-list-row-thumb');
      const placeholder = thumbs[0] as HTMLElement;

      expect(placeholder.tagName).not.toBe('IMG');
      expect(placeholder.classList.contains('image-placeholder')).toBe(true);
      expect(placeholder.querySelector('app-icon')).toBeTruthy();
    });
  });

  describe('query param seeding and sync', () => {
    it('seeds searchText/activeTags/sortKey/sortDir/page from the route query params on init', () => {
      TestBed.overrideProvider(ActivatedRoute, {
        useValue: routeWithQueryParams({
          q: 'abc',
          tags: 'x,y',
          sort: 'createdAt,desc',
          page: '2',
        }),
      });
      fakeRecipeService.getAll.mockReturnValue(of(toPage(mockRecipes, { page: 2, totalPages: 3 })));

      const fixture = TestBed.createComponent(RecipeListComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component['searchText']()).toBe('abc');
      expect([...component['activeTags']()].sort()).toEqual(['x', 'y']);
      expect(component['sortKey']()).toBe('createdAt');
      expect(component['sortDir']()).toBe('desc');
      expect(component['page']()).toBe(2);
      expect(fakeRecipeService.getAll).toHaveBeenCalledWith({
        q: 'abc',
        tags: ['x', 'y'],
        sort: 'createdAt,desc',
        page: 2,
      });
    });

    it('falls back to the localStorage sort preference when the sort param field is invalid', () => {
      localStorage.setItem('recipeListSortKey', 'createdAt');
      localStorage.setItem('recipeListSortDir', 'desc');
      TestBed.overrideProvider(ActivatedRoute, {
        useValue: routeWithQueryParams({ sort: 'notARealField,asc' }),
      });
      fakeRecipeService.getAll.mockReturnValue(of(toPage(mockRecipes)));

      const fixture = TestBed.createComponent(RecipeListComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component['sortKey']()).toBe('createdAt');
      expect(component['sortDir']()).toBe('desc');
    });

    it('defaults sortKey/sortDir to title/asc when neither the sort param nor localStorage are set', () => {
      TestBed.overrideProvider(ActivatedRoute, { useValue: routeWithQueryParams({}) });
      fakeRecipeService.getAll.mockReturnValue(of(toPage(mockRecipes)));

      const fixture = TestBed.createComponent(RecipeListComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component['sortKey']()).toBe('title');
      expect(component['sortDir']()).toBe('asc');
    });

    it('defaults sortDir to asc when the sort param field is valid but the dir is not "desc"', () => {
      TestBed.overrideProvider(ActivatedRoute, {
        useValue: routeWithQueryParams({ sort: 'createdAt,bogus' }),
      });
      fakeRecipeService.getAll.mockReturnValue(of(toPage(mockRecipes)));

      const fixture = TestBed.createComponent(RecipeListComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component['sortKey']()).toBe('createdAt');
      expect(component['sortDir']()).toBe('asc');
    });

    it('defaults page to 0 when the page param is not a valid non-negative integer', () => {
      TestBed.overrideProvider(ActivatedRoute, {
        useValue: routeWithQueryParams({ page: 'not-a-number' }),
      });
      fakeRecipeService.getAll.mockReturnValue(of(toPage(mockRecipes)));

      const fixture = TestBed.createComponent(RecipeListComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component['page']()).toBe(0);
    });

    it('updates the route query params (merging, without a new history entry) when a filter changes', () => {
      fakeRecipeService.getAll.mockReturnValue(of(toPage(mockRecipes)));

      const fixture = TestBed.createComponent(RecipeListComponent);
      fixture.detectChanges();

      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      fixture.componentInstance['toggleTag']('vegan');

      expect(navigateSpy).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          queryParams: expect.objectContaining({ tags: 'vegan', page: null }),
          queryParamsHandling: 'merge',
          replaceUrl: true,
        }),
      );
    });
  });

  describe('favorites and recently-viewed strips', () => {
    function fakeRecipe(id: number, title = `Strip Recipe ${id}`): Recipe {
      return {
        id,
        title,
        description: null,
        content: '## Ingredients\n- Test',
        ingredients: [],
        steps: [],
        createdAt: '2024-01-01T10:00:00',
        updatedAt: '2024-01-01T10:00:00',
      };
    }

    it('renders neither strip when there are no favorites or recently-viewed ids', () => {
      fakeRecipeService.getAll.mockReturnValue(of(toPage(mockRecipes)));

      const fixture = TestBed.createComponent(RecipeListComponent);
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelector('section[aria-label="Favorites"]')).toBeNull();
      expect(element.querySelector('section[aria-label="Recently viewed"]')).toBeNull();
    });

    it('renders the Recently viewed strip only once RecentlyViewedService has an id, with its title', () => {
      fakeRecipeService.getAll.mockReturnValue(of(toPage(mockRecipes)));
      fakeRecipeService.getById.mockImplementation((id: number) =>
        of(fakeRecipe(id, 'Grandma’s Chili')),
      );

      const fixture = TestBed.createComponent(RecipeListComponent);
      fixture.detectChanges();
      expect(
        (fixture.nativeElement as HTMLElement).querySelector(
          'section[aria-label="Recently viewed"]',
        ),
      ).toBeNull();

      const recentlyViewedService = TestBed.inject(RecentlyViewedService);
      recentlyViewedService.record(42);
      fixture.detectChanges();

      const section = (fixture.nativeElement as HTMLElement).querySelector(
        'section[aria-label="Recently viewed"]',
      );
      expect(section).toBeTruthy();
      expect(section?.textContent).toContain('Grandma’s Chili');
    });

    it('updates the Favorites strip with no manual reload when a card favorite button is toggled', () => {
      fakeRecipeService.getAll.mockReturnValue(of(toPage(mockRecipes)));
      fakeRecipeService.getById.mockImplementation((id: number) => of(fakeRecipe(id)));

      const fixture = TestBed.createComponent(RecipeListComponent);
      const element = fixture.nativeElement as HTMLElement;
      fixture.detectChanges();

      expect(element.querySelector('section[aria-label="Favorites"]')).toBeNull();

      const cardFavoriteButton = element.querySelector(
        'button[aria-label="Add to favorites"]',
      ) as HTMLButtonElement;
      cardFavoriteButton.click();
      fixture.detectChanges();

      const favoritesSection = element.querySelector('section[aria-label="Favorites"]');
      expect(favoritesSection).toBeTruthy();
      expect(favoritesSection?.textContent).toContain(fakeRecipe(mockRecipes[0].id).title);

      // Un-favoriting from the strip's own heart button (not the main card)
      // removes it from the strip immediately too.
      const stripHeartButton = favoritesSection?.querySelector(
        'button[aria-label="Remove from favorites"]',
      ) as HTMLButtonElement;
      stripHeartButton.click();
      fixture.detectChanges();

      expect(TestBed.inject(FavoritesService).isFavorite(mockRecipes[0].id)).toBe(false);
      expect(element.querySelector('section[aria-label="Favorites"]')).toBeNull();
    });

    it('drops a stale favorited id whose getById() 404s from the strip and prunes it from FavoritesService, without affecting the other favorite', () => {
      fakeRecipeService.getAll.mockReturnValue(of(toPage(mockRecipes)));
      fakeRecipeService.getById.mockImplementation((id: number) =>
        id === 999 ? throwError(() => new Error('404')) : of(fakeRecipe(id)),
      );

      const favoritesService = TestBed.inject(FavoritesService);
      favoritesService.toggle(999);
      favoritesService.toggle(mockRecipes[1].id);

      const fixture = TestBed.createComponent(RecipeListComponent);
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      const favoritesSection = element.querySelector('section[aria-label="Favorites"]');
      expect(favoritesSection).toBeTruthy();
      expect(favoritesSection?.textContent).toContain(fakeRecipe(mockRecipes[1].id).title);
      expect(favoritesSection?.textContent).not.toContain('Recipe 999');

      expect(favoritesService.isFavorite(999)).toBe(false);
      expect(favoritesService.isFavorite(mockRecipes[1].id)).toBe(true);
    });

    it('drops a stale recently-viewed id whose getById() 404s from the strip and prunes it from RecentlyViewedService', () => {
      fakeRecipeService.getAll.mockReturnValue(of(toPage(mockRecipes)));
      fakeRecipeService.getById.mockImplementation((id: number) =>
        id === 999 ? throwError(() => new Error('404')) : of(fakeRecipe(id)),
      );

      const recentlyViewedService = TestBed.inject(RecentlyViewedService);
      recentlyViewedService.record(999);
      recentlyViewedService.record(mockRecipes[1].id);

      const fixture = TestBed.createComponent(RecipeListComponent);
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      const section = element.querySelector('section[aria-label="Recently viewed"]');
      expect(section).toBeTruthy();
      expect(section?.textContent).toContain(fakeRecipe(mockRecipes[1].id).title);
      expect(section?.textContent).not.toContain('Recipe 999');

      expect(recentlyViewedService.recentIds()).toEqual([mockRecipes[1].id]);
    });

    it('the Clear button empties the Recently viewed strip and RecentlyViewedService storage', () => {
      fakeRecipeService.getAll.mockReturnValue(of(toPage(mockRecipes)));
      fakeRecipeService.getById.mockImplementation((id: number) => of(fakeRecipe(id)));

      const recentlyViewedService = TestBed.inject(RecentlyViewedService);
      recentlyViewedService.record(mockRecipes[0].id);

      const fixture = TestBed.createComponent(RecipeListComponent);
      const element = fixture.nativeElement as HTMLElement;
      fixture.detectChanges();

      expect(element.querySelector('section[aria-label="Recently viewed"]')).toBeTruthy();

      const clearButton = Array.from(
        element.querySelectorAll('section[aria-label="Recently viewed"] button'),
      ).find((btn) => btn.textContent?.trim() === 'Clear') as HTMLButtonElement;
      expect(clearButton).toBeTruthy();

      clearButton.click();
      fixture.detectChanges();

      expect(element.querySelector('section[aria-label="Recently viewed"]')).toBeNull();
      expect(recentlyViewedService.recentIds()).toEqual([]);
      expect(localStorage.getItem('recipeRecentlyViewed')).toBe('[]');
    });
  });
});
