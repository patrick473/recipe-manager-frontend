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
          mockRecipes[0],
          expect.any(Function),
        );
        expect(component['recipes']()).toEqual([mockRecipes[1]]);
      });

      it('renders an Edit link pointing at the recipe edit route', () => {
        const fixture = createFixtureInMode(mode);

        const editLink = findEditLink(fixture.nativeElement);

        expect(editLink.getAttribute('href')).toBe(`/recipes/${mockRecipes[0].id}/edit`);
      });
    });
  });
});
