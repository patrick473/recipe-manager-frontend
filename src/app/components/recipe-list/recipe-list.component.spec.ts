import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Recipe } from '../../models/recipe.model';
import { RecipeService } from '../../services/recipe.service';
import { RecipeListComponent } from './recipe-list.component';

const mockRecipes: Recipe[] = [
  {
    id: 1,
    title: 'Pasta Carbonara',
    description: 'Classic Italian pasta',
    content: '## Ingredients\n- Pasta\n- Eggs',
    createdAt: '2024-01-01T10:00:00',
    updatedAt: '2024-01-01T10:00:00',
  },
  {
    id: 2,
    title: 'Banana Bread',
    description: null,
    content: '## Ingredients\n- Bananas\n- Flour',
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
    tags: ['breakfast', 'sweet'],
    createdAt: '2024-01-01T10:00:00',
    updatedAt: '2024-01-01T10:00:00',
  },
  {
    id: 2,
    title: 'Omelette',
    description: 'Quick breakfast eggs',
    content: '## Ingredients\n- Eggs',
    tags: ['breakfast', 'quick'],
    createdAt: '2024-01-02T10:00:00',
    updatedAt: '2024-01-02T10:00:00',
  },
  {
    id: 3,
    title: 'Steak',
    description: 'Hearty dinner main',
    content: '## Ingredients\n- Steak',
    tags: ['dinner'],
    createdAt: '2024-01-03T10:00:00',
    updatedAt: '2024-01-03T10:00:00',
  },
];

const sortableRecipes: Recipe[] = [
  {
    id: 1,
    title: 'Banana Bread',
    description: null,
    content: '## Ingredients\n- Bananas',
    prepTimeMinutes: 10,
    cookTimeMinutes: 45,
    createdAt: '2024-01-03T00:00:00',
    updatedAt: '2024-01-05T00:00:00',
  },
  {
    id: 2,
    title: 'Apple Pie',
    description: null,
    content: '## Ingredients\n- Apples',
    prepTimeMinutes: null,
    cookTimeMinutes: 30,
    createdAt: '2024-01-01T00:00:00',
    updatedAt: '2024-01-04T00:00:00',
  },
  {
    id: 3,
    title: 'Carrot Cake',
    description: null,
    content: '## Ingredients\n- Carrots',
    prepTimeMinutes: 20,
    cookTimeMinutes: null,
    createdAt: '2024-01-02T00:00:00',
    updatedAt: '2024-01-06T00:00:00',
  },
];

describe('RecipeListComponent', () => {
  let fakeRecipeService: {
    getAll: ReturnType<typeof vi.fn>;
    deleteWithConfirm: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    localStorage.clear();

    fakeRecipeService = {
      getAll: vi.fn(),
      deleteWithConfirm: vi.fn(),
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
    fakeRecipeService.getAll.mockReturnValue(of(mockRecipes));

    const fixture = TestBed.createComponent(RecipeListComponent);
    const component = fixture.componentInstance;

    fixture.detectChanges();

    expect(component['recipes']()).toEqual(mockRecipes);
    expect(component['loading']()).toBe(false);
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
    fakeRecipeService.getAll.mockReturnValue(of(mockRecipes));
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

  it('leaves recipes() unchanged when the delete is cancelled', () => {
    fakeRecipeService.getAll.mockReturnValue(of(mockRecipes));
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
    fakeRecipeService.getAll.mockReturnValue(of(mockRecipes));
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
    fakeRecipeService.getAll.mockReturnValue(of(mockRecipes));
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
      fakeRecipeService.getAll.mockReturnValue(of(mockRecipes));
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

    it('defaults to grid mode when localStorage has no stored preference', () => {
      fakeRecipeService.getAll.mockReturnValue(of(mockRecipes));

      const fixture = TestBed.createComponent(RecipeListComponent);
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelector('.recipe-grid')).toBeTruthy();
      expect(element.querySelector('.recipe-list')).toBeNull();
    });

    it('switches to list markup on toggle click and persists the choice to localStorage, surviving a fresh component instance', () => {
      fakeRecipeService.getAll.mockReturnValue(of(mockRecipes));

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
      fakeRecipeService.getAll.mockReturnValue(of(mockRecipes));

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
      // Default sort is title-ascending, so "Banana Bread" (mockRecipes[1])
      // renders before "Pasta Carbonara" (mockRecipes[0]).
      const sortedFirst = mockRecipes[1];
      const sortedSecond = mockRecipes[0];

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
          sortedFirst,
          expect.any(Function),
        );
        expect(component['recipes']()).toEqual([sortedSecond]);
      });

      it('renders an Edit link pointing at the recipe edit route', () => {
        const fixture = createFixtureInMode(mode);

        const editLink = findEditLink(fixture.nativeElement);

        expect(editLink.getAttribute('href')).toBe(`/recipes/${sortedFirst.id}/edit`);
      });
    });
  });

  describe('search & tag filtering', () => {
    function createFixtureWithTaggedRecipes() {
      fakeRecipeService.getAll.mockReturnValue(of(taggedRecipes));
      const fixture = TestBed.createComponent(RecipeListComponent);
      fixture.detectChanges();
      return fixture;
    }

    it('filters by title substring, case-insensitively', () => {
      const fixture = createFixtureWithTaggedRecipes();
      const component = fixture.componentInstance;

      component['searchText'].set('OMELE');

      expect(component['filteredRecipes']()).toEqual([taggedRecipes[1]]);
    });

    it('filters by description substring, case-insensitively', () => {
      const fixture = createFixtureWithTaggedRecipes();
      const component = fixture.componentInstance;

      component['searchText'].set('hearty');

      expect(component['filteredRecipes']()).toEqual([taggedRecipes[2]]);
    });

    it('computes availableTags as the distinct, sorted set of tags across all recipes', () => {
      const fixture = createFixtureWithTaggedRecipes();
      const component = fixture.componentInstance;

      expect(component['availableTags']()).toEqual(['breakfast', 'dinner', 'quick', 'sweet']);
    });

    it('toggleTag filters recipes with OR semantics among selected tags', () => {
      const fixture = createFixtureWithTaggedRecipes();
      const component = fixture.componentInstance;

      component['toggleTag']('breakfast');

      expect(component['filteredRecipes']()).toEqual([taggedRecipes[0], taggedRecipes[1]]);

      component['toggleTag']('dinner');

      expect(component['filteredRecipes']()).toEqual(taggedRecipes);
    });

    it('toggleTag flips membership back off when called again with the same tag', () => {
      const fixture = createFixtureWithTaggedRecipes();
      const component = fixture.componentInstance;

      component['toggleTag']('breakfast');
      component['toggleTag']('breakfast');

      expect(component['activeTags']().size).toBe(0);
      expect(component['filteredRecipes']()).toEqual(taggedRecipes);
    });

    it('combines search text and tag selection with AND semantics', () => {
      const fixture = createFixtureWithTaggedRecipes();
      const component = fixture.componentInstance;

      component['searchText'].set('omelette');
      component['toggleTag']('breakfast');

      // Pancakes has the "breakfast" tag but doesn't match the search text,
      // so only Omelette (matches both) should remain.
      expect(component['filteredRecipes']()).toEqual([taggedRecipes[1]]);
    });

    it('restores the full list when search text and tags are cleared', () => {
      const fixture = createFixtureWithTaggedRecipes();
      const component = fixture.componentInstance;

      component['searchText'].set('omelette');
      component['toggleTag']('breakfast');
      component['searchText'].set('');
      component['toggleTag']('breakfast');

      expect(component['filteredRecipes']()).toEqual(taggedRecipes);
    });

    it('does not render the tag-chip row when no recipe has any tags', () => {
      fakeRecipeService.getAll.mockReturnValue(of(mockRecipes));
      const fixture = TestBed.createComponent(RecipeListComponent);
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelector('.recipe-tag-filters')).toBeNull();
    });

    it('renders a tag chip per distinct tag and reflects activeTags() in aria-pressed', () => {
      const fixture = createFixtureWithTaggedRecipes();
      const element = fixture.nativeElement as HTMLElement;

      const chips = Array.from(element.querySelectorAll('.filter-chip'));
      expect(chips.map((c) => c.textContent?.trim())).toEqual([
        'breakfast',
        'dinner',
        'quick',
        'sweet',
      ]);

      const breakfastChip = chips.find((c) => c.textContent?.trim() === 'breakfast') as
        | HTMLButtonElement
        | undefined;
      expect(breakfastChip?.getAttribute('aria-pressed')).toBe('false');

      breakfastChip?.click();
      fixture.detectChanges();

      expect(breakfastChip?.getAttribute('aria-pressed')).toBe('true');
    });
  });

  describe('sorting', () => {
    function createSortedFixture(key?: string, dir?: string) {
      if (key) localStorage.setItem('recipeListSortKey', key);
      if (dir) localStorage.setItem('recipeListSortDir', dir);
      fakeRecipeService.getAll.mockReturnValue(of(sortableRecipes));
      const fixture = TestBed.createComponent(RecipeListComponent);
      fixture.detectChanges();
      return fixture;
    }

    function titlesOf(recipes: Recipe[]): string[] {
      return recipes.map((r) => r.title);
    }

    it('sorts by title ascending and descending', () => {
      const ascFixture = createSortedFixture('title', 'asc');
      expect(titlesOf(ascFixture.componentInstance['sortedRecipes']())).toEqual([
        'Apple Pie',
        'Banana Bread',
        'Carrot Cake',
      ]);

      const descFixture = createSortedFixture('title', 'desc');
      expect(titlesOf(descFixture.componentInstance['sortedRecipes']())).toEqual([
        'Carrot Cake',
        'Banana Bread',
        'Apple Pie',
      ]);
    });

    it('sorts by prepTimeMinutes ascending and descending, with nulls last in both directions', () => {
      const ascFixture = createSortedFixture('prepTimeMinutes', 'asc');
      expect(titlesOf(ascFixture.componentInstance['sortedRecipes']())).toEqual([
        'Banana Bread',
        'Carrot Cake',
        'Apple Pie',
      ]);

      const descFixture = createSortedFixture('prepTimeMinutes', 'desc');
      expect(titlesOf(descFixture.componentInstance['sortedRecipes']())).toEqual([
        'Carrot Cake',
        'Banana Bread',
        'Apple Pie',
      ]);
    });

    it('sorts by cookTimeMinutes ascending and descending, with nulls last in both directions', () => {
      const ascFixture = createSortedFixture('cookTimeMinutes', 'asc');
      expect(titlesOf(ascFixture.componentInstance['sortedRecipes']())).toEqual([
        'Apple Pie',
        'Banana Bread',
        'Carrot Cake',
      ]);

      const descFixture = createSortedFixture('cookTimeMinutes', 'desc');
      expect(titlesOf(descFixture.componentInstance['sortedRecipes']())).toEqual([
        'Banana Bread',
        'Apple Pie',
        'Carrot Cake',
      ]);
    });

    it('sorts by createdAt ascending and descending', () => {
      const ascFixture = createSortedFixture('createdAt', 'asc');
      expect(titlesOf(ascFixture.componentInstance['sortedRecipes']())).toEqual([
        'Apple Pie',
        'Carrot Cake',
        'Banana Bread',
      ]);

      const descFixture = createSortedFixture('createdAt', 'desc');
      expect(titlesOf(descFixture.componentInstance['sortedRecipes']())).toEqual([
        'Banana Bread',
        'Carrot Cake',
        'Apple Pie',
      ]);
    });

    it('sorts by updatedAt ascending and descending', () => {
      const ascFixture = createSortedFixture('updatedAt', 'asc');
      expect(titlesOf(ascFixture.componentInstance['sortedRecipes']())).toEqual([
        'Apple Pie',
        'Banana Bread',
        'Carrot Cake',
      ]);

      const descFixture = createSortedFixture('updatedAt', 'desc');
      expect(titlesOf(descFixture.componentInstance['sortedRecipes']())).toEqual([
        'Carrot Cake',
        'Banana Bread',
        'Apple Pie',
      ]);
    });

    it('defaults to title/asc when localStorage has no stored sort preference', () => {
      const fixture = createSortedFixture();
      const component = fixture.componentInstance;

      expect(component['sortKey']()).toBe('title');
      expect(component['sortDir']()).toBe('asc');
    });

    it('setSort flips direction when called with the already-active key', () => {
      const fixture = createSortedFixture('title', 'asc');
      const component = fixture.componentInstance;

      component['setSort']('title');

      expect(component['sortDir']()).toBe('desc');

      component['setSort']('title');

      expect(component['sortDir']()).toBe('asc');
    });

    it('setSort resets direction to asc when switching to a new key', () => {
      const fixture = createSortedFixture('title', 'desc');
      const component = fixture.componentInstance;

      component['setSort']('createdAt');

      expect(component['sortKey']()).toBe('createdAt');
      expect(component['sortDir']()).toBe('asc');
    });

    it('persists sort key/direction to localStorage and survives a fresh component instance', () => {
      const fixture = createSortedFixture();
      const component = fixture.componentInstance;

      component['setSort']('cookTimeMinutes');

      expect(localStorage.getItem('recipeListSortKey')).toBe('cookTimeMinutes');
      expect(localStorage.getItem('recipeListSortDir')).toBe('asc');

      const reloadedFixture = TestBed.createComponent(RecipeListComponent);
      reloadedFixture.detectChanges();

      expect(reloadedFixture.componentInstance['sortKey']()).toBe('cookTimeMinutes');
      expect(reloadedFixture.componentInstance['sortDir']()).toBe('asc');
    });

    it('the direction toggle button flips sortDir() via setSort(sortKey())', () => {
      const fixture = createSortedFixture('title', 'asc');
      const element = fixture.nativeElement as HTMLElement;

      const directionButton = element.querySelector(
        'button[aria-label="Sort ascending"]',
      ) as HTMLButtonElement;
      expect(directionButton).toBeTruthy();

      directionButton.click();
      fixture.detectChanges();

      expect(fixture.componentInstance['sortDir']()).toBe('desc');
      expect(element.querySelector('button[aria-label="Sort descending"]')).toBeTruthy();
    });

    it('changing the sort <select> switches sortKey() and re-renders sorted order', () => {
      const fixture = createSortedFixture('title', 'asc');
      const element = fixture.nativeElement as HTMLElement;

      const select = element.querySelector('.recipe-sort-select') as HTMLSelectElement;
      select.value = 'createdAt';
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(fixture.componentInstance['sortKey']()).toBe('createdAt');
    });
  });

  describe('empty/error state polish', () => {
    it('shows the "no matches" empty state when recipes exist but the filtered/sorted result is empty', () => {
      fakeRecipeService.getAll.mockReturnValue(of(taggedRecipes));
      const fixture = TestBed.createComponent(RecipeListComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      component['searchText'].set('this matches nothing at all');
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      expect(element.textContent).toContain('No recipes match your search.');
      expect(element.textContent).not.toContain('No recipes yet');
    });

    it('does not show the "no matches" state when there are truly no recipes', () => {
      fakeRecipeService.getAll.mockReturnValue(of([]));
      const fixture = TestBed.createComponent(RecipeListComponent);
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      expect(element.textContent).toContain('No recipes yet');
      expect(element.textContent).not.toContain('No recipes match your search.');
    });

    it('does not show the "no matches" state while the load errored', () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      fakeRecipeService.getAll.mockReturnValue(throwError(() => new Error('boom')));
      const fixture = TestBed.createComponent(RecipeListComponent);
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      expect(element.textContent).not.toContain('No recipes match your search.');
      expect(element.textContent).toContain('Failed to load recipes. Is the backend running?');
    });

    it('does not show the "no matches" state when filters currently match at least one recipe', () => {
      fakeRecipeService.getAll.mockReturnValue(of(taggedRecipes));
      const fixture = TestBed.createComponent(RecipeListComponent);
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      expect(element.textContent).not.toContain('No recipes match your search.');
    });

    it('clearFilters resets searchText() and activeTags() and restores the full list', () => {
      fakeRecipeService.getAll.mockReturnValue(of(taggedRecipes));
      const fixture = TestBed.createComponent(RecipeListComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      component['searchText'].set('nothing matches this');
      component['toggleTag']('breakfast');

      expect(component['sortedRecipes']().length).toBe(0);

      component['clearFilters']();

      expect(component['searchText']()).toBe('');
      expect(component['activeTags']().size).toBe(0);
      expect(component['sortedRecipes']().length).toBe(taggedRecipes.length);
    });

    it('clicking "Clear filters" in the "no matches" state restores the full list', () => {
      fakeRecipeService.getAll.mockReturnValue(of(taggedRecipes));
      const fixture = TestBed.createComponent(RecipeListComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      component['searchText'].set('nothing matches this');
      fixture.detectChanges();

      const clearButton = Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
      ).find((btn) => btn.textContent?.includes('Clear filters')) as HTMLButtonElement;
      expect(clearButton).toBeTruthy();

      clearButton.click();
      fixture.detectChanges();

      expect(component['searchText']()).toBe('');
      expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
        'No recipes match your search.',
      );
    });
  });
});
