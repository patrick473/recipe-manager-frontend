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
});
